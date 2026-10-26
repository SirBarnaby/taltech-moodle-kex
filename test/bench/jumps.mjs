// Jump audit (round 9): every kind of click on the capture site, with each layout shift and the element that moved.
// A layout shift is what the reader sees as a jump: something already on screen moves because something else changed size or
// arrived late. Smooth, intended motion (transforms, the glide, view transitions) is not a layout shift and does not count.
// A move counts as a jump when an element lands in its new place in one frame; the same element moving over several frames in a
// row is an animation (a slot opening, the menu folding) and only adds to the shift score.
// Also reports frames where the content area is empty during a navigation (a "blank flash").
// Run: npm run build:dev && node test/bench/jumps.mjs [scenario,...] [--theme dark] [--verbose]   (exit 1 when anything jumps)
import { launch, open, HOST } from '../harness/capsite.mjs';

const args = process.argv.slice(2);
const only = args.find((a) => !a.startsWith('--'))?.split(',');
const theme = args.includes('--theme') ? args[args.indexOf('--theme') + 1] : 'light';
const verbose = args.includes('--verbose');
const WWW = `https://${HOST}`;

/** Records layout shifts (with the moved nodes) and, every frame, whether #kex-main has content on screen. */
const RECORDER = `(() => {
  if (window.top !== window) return;
  const desc = (n) => { if (!n || n.nodeType !== 1) return n?.nodeName ?? '?'; const c = typeof n.className === 'string' ? n.className.trim().split(/\\s+/).filter((x) => x.startsWith('kex-')).slice(0, 2).join('.') : ''; return n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + (c ? '.' + c : '') + (n.dataset?.kexTest ? '[' + n.dataset.kexTest + ']' : ''); };
  window.__shifts = [];
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), input: e.hadRecentInput, src: e.sources.map((s) => ({ n: desc(s.node), from: [s.previousRect.x, s.previousRect.y, s.previousRect.width, s.previousRect.height].map(Math.round), to: [s.currentRect.x, s.currentRect.y, s.currentRect.width, s.currentRect.height].map(Math.round) })) }); }).observe({ type: 'layout-shift', buffered: true });
  } catch {}
  window.__blank = [];
  const f = () => { const m = document.querySelector('#kex-main, #region-main'); const r = m?.getBoundingClientRect(); let filled = false; if (m && r && r.height > 40) { const kids = m.querySelectorAll(':scope > *'); for (const k of kids) { const kr = k.getBoundingClientRect(); const op = +getComputedStyle(k).opacity; if (kr.height > 30 && op > 0.3) { filled = true; break; } } } window.__blank.push([Math.round(performance.now()), filled ? 1 : 0]); if (window.__blank.length < 4000) requestAnimationFrame(f); };
  requestAnimationFrame(f);
})();`;

const settle = (page, ms = 1600) => page.waitForTimeout(ms);
async function ready(page, timeout = 10000) {
  await page.waitForFunction(() => document.documentElement.dataset.kexShell === 'ready' && !document.documentElement.dataset.kexNav, null, { timeout }).catch(() => undefined);
}
const mark = (page) => page.evaluate(() => { window.__mark = performance.now(); window.__shifts = window.__shifts ?? []; return window.__mark; });
async function collect(page, since) {
  return page.evaluate((since) => ({
    shifts: (window.__shifts ?? []).filter((s) => s.t >= since - 5),
    blankMs: (() => { const b = (window.__blank ?? []).filter(([t]) => t >= since); let ms = 0; for (let i = 1; i < b.length; i++) if (!b[i - 1][1]) ms += b[i][0] - b[i - 1][0]; return Math.round(ms); })(),
    url: location.pathname + location.search + location.hash,
  }), since ?? 0);
}
async function click(page, sel) {
  const el = await page.waitForSelector(sel, { timeout: 5000 });
  await el.scrollIntoViewIfNeeded();
  await el.click();
}
/** A click that leaves the page (full load): the new document's own recorder starts at 0. */
async function clickAway(page, sel) {
  await Promise.all([page.waitForEvent('load', { timeout: 15000 }).catch(() => undefined), click(page, sel)]);
  await ready(page);
  await settle(page, 2000);
  return collect(page, 0);
}
async function clickHere(page, sel, ms = 1600) {
  const t = await mark(page);
  await click(page, sel);
  await ready(page);
  await settle(page, ms);
  return collect(page, t);
}

const scenarios = {
  'load-mycourses': async (b) => { const p = await go(b, 'mycourses'); return collect(p, 0); },
  'load-course': async (b) => { const p = await go(b, 'course-37582'); return collect(p, 0); },
  'load-dossier': async (b) => { const p = await go(b, 'my', '/my/?view=dossier'); return collect(p, 0); },
  'mycourses>course': async (b) => { const p = await go(b, 'mycourses'); return clickHere(p, '.kex-mc a[href*="37829"], a.kex-mc[href*="37829"], .kex-mc[href*="37829"]'); },
  'sidebar>course': async (b) => { const p = await go(b, 'course-37582'); return clickHere(p, '.kex-sb__course[data-course-id="38420"]'); },
  'sidebar>mycourses': async (b) => { const p = await go(b, 'course-37582'); return clickHere(p, '.kex-sb__nav a[href$="/my/courses.php"]'); },
  'sidebar>dossier': async (b) => { const p = await go(b, 'mycourses'); return clickHere(p, '.kex-sb__nav a[href*="view=dossier"]:not([href*="#"])'); },
  'sidebar>pinned': async (b) => { const p = await go(b, 'mycourses'); return clickHere(p, '.kex-sb__nav a[href*="#pinned"]'); },
  'sidebar>achievements': async (b) => { const p = await go(b, 'mycourses'); return clickHere(p, '.kex-sb__nav a[href*="#achievements"]'); },
  'topic>topic': async (b) => { const p = await go(b, 'course-37582'); return clickHere(p, '[data-kex-test="topics-row-4"]'); },
  'crumb>mycourses': async (b) => { const p = await go(b, 'course-37582'); return clickHere(p, '.kex-crumbs a[href*="/my/"]'); },
  'course>participants': async (b) => { const p = await go(b, 'course-37582'); return clickAway(p, '.kex-coursenav a[href*="/user/index.php"]'); },
  'participants>course': async (b) => { const p = await go(b, 'participants'); return clickAway(p, '.kex-sb__course[data-course-id="37829"]'); },
  'mycourses-tabs': async (b) => { const p = await go(b, 'mycourses'); return clickHere(p, '[data-kex-test="mc-tabs"] button:nth-child(2), .kex-mc-tabs button:nth-child(2), .kex-tabs button:nth-child(2)'); },
  'theme-toggle': async (b) => { const p = await go(b, 'course-37582'); return clickHere(p, '[data-kex-test="theme-toggle"]', 900); },
  'sidebar-toggle': async (b) => { const p = await go(b, 'course-37582'); return clickHere(p, '[data-kex-test="sidebar-toggle"]', 900); },
  'back-from-course': async (b) => {
    const p = await go(b, 'mycourses');
    await clickHere(p, '.kex-sb__course[data-course-id="37829"]');
    const t = await mark(p); await p.goBack(); await ready(p); await settle(p); return collect(p, t);
  },
};

let ctxOpts = {};
async function go(browser, name, path) {
  const page = await open(browser, name, { theme, settings: { theme, effects: 'static' }, goto: false, viewport: { width: 1440, height: 900 }, ...ctxOpts });
  await page.addInitScript(RECORDER);
  page.on('pageerror', (e) => { if (!/js_pending|help_popups|M\.(util|cfg)|require is not defined/.test(String(e))) console.log('  pageerror', String(e).slice(0, 160)); });
  const { PAGES } = await import('../harness/capsite.mjs');
  await page.goto(WWW + (path ?? PAGES[name][0]), { waitUntil: 'load' });
  await ready(page);
  await settle(page, 1800);
  scenarios.__page = page;
  return page;
}

const browser = await launch();
let bad = 0;
for (const [name, run] of Object.entries(scenarios)) {
  if (name.startsWith('__') || (only && !only.includes(name))) continue;
  let r;
  try {
    r = await run(browser);
  } catch (e) {
    console.log(`ERR  ${name}: ${String(e).split('\n')[0]}`);
    bad++;
    await scenarios.__page?.context().close().catch(() => undefined);
    continue;
  }
  const total = r.shifts.reduce((a, s) => a + s.v, 0);
  // One-frame moves: a source displaced (or resized) by more than 8 px with no move of the same element within 300 ms around it
  // (this software-rendered browser can drop frames for 100 ms and more, so an animation's steps can be far apart).
  const moved = (x) => Math.max(...x.from.map((v, i) => Math.abs(v - x.to[i])));
  const jumps = [];
  r.shifts.forEach((s, i) => {
    for (const x of s.src) {
      // Appearing (from an empty box: text filling a fixed avatar or title host) or going (to 0x0) is not a move.
      if (x.to[2] === 0 || x.from[2] < 6 || x.from[3] < 6 || moved(x) <= 8) continue;
      const near = r.shifts.some((o, j) => j !== i && Math.abs(o.t - s.t) <= 300 && o.src.some((y) => y.n === x.n));
      if (!near) jumps.push({ t: s.t, n: x.n, d: Math.round(moved(x)) });
    }
  });
  r.jumps = jumps;
  const jumped = jumps.length > 0 || r.blankMs > 120;
  if (jumped) bad++;
  console.log(`${jumped ? 'JUMP' : 'ok  '} ${name.padEnd(22)} shift ${total.toFixed(3)}  blank ${r.blankMs}ms  ${r.url}${jumps.length ? '  ' + jumps.map((j) => `${j.n} ${j.d}px @${j.t}`).join(', ') : ''}`);
  if (jumped || verbose) {
    for (const s of r.shifts) console.log(`       t=${s.t} v=${s.v}${s.input ? ' (input)' : ''} ` + s.src.map((x) => `${x.n} ${x.from.join(',')} -> ${x.to.join(',')}`).join(' | '));
  }
  await scenarios.__page?.context().close().catch(() => undefined);
}
await browser.close();
process.exit(bad ? 1 : 0);
