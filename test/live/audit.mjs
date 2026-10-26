// Live jump audit (round 10): what a reader does, in the tester's own Firefox on live Moodle, with every frame recorded in the page.
// A scenario fails on a scroll change nobody asked for, or on something on screen moving more than 4 px in one frame by itself
// (a press's own 3 % shrink is not a move).
// Run: npm run build, then node test/live/audit.mjs [scenario-prefix,...]   (test/live/wd.mjs start first; the test profile must
// be signed in). The report goes to artifacts/live/<time>.json.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as s from './steps.mjs';
import { ensureSession, WWW } from './wd.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const only = process.argv[2]?.split(',');
const COURSES = { topics: 37829, labs: 37582, tiles: 38420 };

/** Judge the frames recorded since `since`: unrequested scroll jumps, one-frame moves (jumps) and multi-frame moves (glides). */
function judge(r, since, { scrollAllowed = false, layout = false } = {}) {
  const frames = r.frames.filter((f) => f.t >= since);
  const inputs = r.events.filter((e) => e.type === 'wheel' || e.type === 'keydown');
  const scrollJumps = [];
  for (let i = 1; i < frames.length; i++) {
    const d = frames[i].y - frames[i - 1].y;
    const byInput = inputs.some((e) => e.t <= frames[i].t && frames[i].t - e.t < 900);
    if (Math.abs(d) > 40 && !byInput && !scrollAllowed) scrollJumps.push(`${frames[i - 1].y}->${frames[i].y} @+${frames[i].t - since}ms`);
  }
  const moves = r.moves.filter((m) => m.t >= since);
  const ft = frames.map((f) => f.t);
  const idx = (t) => ft.indexOf(t);
  const byEl = new Map();
  for (const m of moves) byEl.set(m.el, (byEl.get(m.el) ?? []).concat(m));
  const jumps = [];
  const glides = [];
  for (const [el, list] of byEl) {
    // Fixed things move on screen only through scrolling; that is judged above.
    if (/kex-header|kex-crumbs|kex-sidebar|kex-outline/.test(el)) continue;
    // An element running its own animation (a row's entrance) is moving on purpose, frame by frame.
    const single = list.filter((m) => !m.anim && !list.some((o) => o !== m && Math.abs(idx(o.t) - idx(m.t)) <= 2)).filter((m) => Math.abs(m.dy) > 4 || Math.abs(m.dx) > 4);
    for (const m of single) jumps.push(`${el} ${m.dy ? `dy ${m.dy}` : ''}${m.dx ? ` dx ${m.dx}` : ''} @+${m.t - since}ms`);
    if (list.length - single.length > 2) glides.push(`${el} x${list.length}`);
  }
  return { ok: !scrollJumps.length && (layout || !jumps.length), scrollJumps, jumps: layout ? [] : jumps.slice(0, 20), glides: glides.slice(0, 8) };
}

const results = [];
async function step(name, fn, { wait = 1500, ...opts } = {}) {
  if (only && !only.some((o) => name.startsWith(o))) return;
  let out;
  try {
    await s.record();
    const t = await s.now();
    const extra = await fn();
    await s.sleep(wait);
    // A step that loads a new document has no frames from before it to judge: its own checks decide.
    const verdict = opts.reloads ? { ok: true } : judge(await s.dump(), t, opts);
    out = { name, ...verdict, ...(extra && typeof extra === 'object' ? { note: extra } : {}), state: await s.state() };
  } catch (e) {
    out = { name, ok: false, error: String(e).split('\n')[0] };
  }
  results.push(out);
  console.log(`${out.ok ? 'ok  ' : 'FAIL'} ${name}${out.error ? `  ${out.error}` : ''}`);
  for (const k of ['scrollJumps', 'jumps']) for (const line of out[k] ?? []) console.log(`       ${k === 'jumps' ? 'moved' : 'scroll'} ${line}`);
}

/** A topic link the reader can see: the outline in a wide column, the topic bar in a narrow one. */
const topicLink = (n) => `.kex-outline [data-kex-topic="${n}"], .kex-cbar [data-kex-bartopic="${n}"]`;
const topicsOf = () => s.exec(`return [...document.querySelectorAll('[data-kex-section]')].map((e) => e.dataset.kexSection)`);

await ensureSession();

// ---- the reader's own steps: open a course, scroll a little, switch topics, two or three clicks in a row ----
for (const [kind, id] of Object.entries(COURSES)) {
  if (only && !only.some((o) => `course ${kind}`.startsWith(o) || o.startsWith(`course ${kind}`))) continue;
  await s.load(`${WWW}/my/courses.php`);
  // Opening a course puts the page where the reader left it, under the page change: that scroll is the page's own.
  await step(`course ${kind}: open from My courses`, () => s.click(`.kex-mc[href*="id=${id}"], a[href*="course/view.php?id=${id}"]`), { wait: 2200, scrollAllowed: true });
  await step(`course ${kind}: scroll a little`, () => s.wheel(300));
  const tps = await topicsOf();
  const picks = [tps[2], tps[tps.length - 1], tps[1], tps[3] ?? tps[0]].filter((x) => x !== undefined);
  for (const n of picks) await step(`course ${kind}: topic ${n}`, () => s.click(topicLink(n)), { scrollAllowed: true });
  await step(`course ${kind}: scroll down more`, () => s.wheel(900));
  await step(`course ${kind}: fold a topic`, () => s.click('.kex-tsec__toggle'));
  await step(`course ${kind}: unfold it`, () => s.click('.kex-tsec--folded .kex-tsec__toggle'));
  await step(`course ${kind}: keys j j j`, async () => { await s.key('j'); await s.key('j'); await s.key('j'); }, { scrollAllowed: true });
  // The side reader narrows the column on purpose; what must not move is the row being read.
  await step(`course ${kind}: preview and close`, async () => {
    const row = await s.exec(`for (const b of document.querySelectorAll('.kex-row [data-act="preview"]')) { const r = b.getBoundingClientRect(); if (r.top > 120 && r.bottom < innerHeight - 40) return b.closest('.kex-row').dataset.kexRow; } return null;`);
    if (!row) throw new Error('no material on screen to preview');
    const at = () => s.exec(`return Math.round(document.querySelector('[data-kex-row="${row}"]').getBoundingClientRect().top);`);
    const before = await at();
    await s.click(`[data-kex-row="${row}"] [data-act="preview"]`);
    await s.sleep(900);
    const open = await at();
    await s.key('Escape');
    await s.sleep(900);
    const closed = await at();
    if (Math.abs(closed - open) > 4) throw new Error(`the row moved from ${open} to ${closed} when the reader closed`);
    return { before, open, closed };
  }, { wait: 300, scrollAllowed: true, layout: true });
  await step(`course ${kind}: reopen keeps the place`, async () => {
    const before = await s.state();
    await s.sleep(600);
    await s.load(`${WWW}/course/view.php?id=${id}`);
    const after = await s.state();
    // A page shorter than the one left (a fold's held end is gone) can only open at its own bottom.
    const expect = Math.min(before.y, after.h - after.vh);
    if (Math.abs(after.y - expect) > 24) throw new Error(`reopened at ${after.y}, left at ${before.y}`);
    return { before: before.y, after: after.y };
  }, { reloads: true });
}

// ---- pages ----
await s.load(`${WWW}/course/view.php?id=${COURSES.labs}`);
await step('pages: sidebar to another course', () => s.click('.kex-sidebar a[href*="id=38175"]'), { wait: 2200, scrollAllowed: true });
await step('pages: sidebar to My courses', () => s.click('.kex-sb__nav a[href$="/my/courses.php"]'), { wait: 2200, scrollAllowed: true });
await step('pages: My courses tab', () => s.click('[role="tab"]:nth-child(2)'));
await step('pages: sidebar to Dossier', () => s.click('.kex-sb__nav a[href*="view=dossier"]:not([href*="#"])'), { wait: 2200, scrollAllowed: true });
await step('pages: Back', () => s.exec('history.back()'), { wait: 2200, scrollAllowed: true });
await step('pages: Back to a course returns to its place', async () => {
  await s.click('.kex-sidebar a[href*="id=37582"]');
  await s.sleep(2200);
  await s.wheel(1400);
  await s.sleep(1200);
  const left = await s.state();
  await s.click('.kex-sb__nav a[href$="/my/courses.php"]');
  await s.sleep(2000);
  await s.exec('history.back()');
  await s.sleep(2500);
  const back = await s.state();
  if (Math.abs(back.y - left.y) > 24) throw new Error(`Back returned to ${back.y}, left at ${left.y}`);
  return { left: left.y, back: back.y };
}, { wait: 300, scrollAllowed: true });
await step('pages: theme toggle', () => s.click('[data-kex-test="theme-toggle"]'), { wait: 900 });
await step('pages: theme toggle back', () => s.click('[data-kex-test="theme-toggle"]'), { wait: 900 });
await step('pages: menu fold', () => s.click('[data-kex-test="sidebar-toggle"]'), { wait: 900 });
await step('pages: menu unfold', () => s.click('[data-kex-test="sidebar-toggle"]'), { wait: 900 });

const dir = path.join(ROOT, 'artifacts', 'live');
mkdirSync(dir, { recursive: true });
const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), results }, null, 1)}\n`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} clean · ${path.relative(ROOT, file)}`);
process.exit(failed ? 1 : 0);
