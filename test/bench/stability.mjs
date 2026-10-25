// Layout-stability regression checks on the lab Moodle with the dev add-on (round 7: "jumps", sidebar, labs, notices).
// Needs: Selenium standalone Firefox (KEX_SELENIUM, default http://localhost:4444), the Moodle 4.5 lab (KEX_LAB, default
// http://localhost:8081, student / Student#2026, course 3 = EMT0140, course 4 = IAS0230 with 13 lab subsections) and
// `npm run pack:dev`. Run: node test/bench/stability.mjs [check,...]   Exit code 1 when a check fails.
import path from 'node:path';
import { Builder, By, Origin } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';

const LAB = process.env.KEX_LAB ?? 'http://localhost:8081';
const SELENIUM = process.env.KEX_SELENIUM ?? 'http://localhost:4444';
const only = process.argv[2]?.split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

async function browser(width = 1851, height = 1080) {
  const o = new firefox.Options();
  o.setPreference('extensions.autoDisableScopes', 0);
  // Classic scrollbars that take real width, as on Windows 10.
  o.setPreference('widget.gtk.overlay-scrollbars.enabled', false);
  o.setPreference('widget.non-native-theme.scrollbar.style', 4);
  const d = await new Builder().forBrowser('firefox').usingServer(SELENIUM).setFirefoxOptions(o).build();
  await d.manage().window().setRect({ width, height, x: 0, y: 0 });
  await d.installAddon(path.resolve('dist/packages/kex-dev.xpi'), true);
  await d.get(`${LAB}/login/index.php`);
  await sleep(1200);
  await d.findElement(By.css('#username')).sendKeys('student');
  await d.findElement(By.css('#password')).sendKeys('Student#2026');
  await d.findElement(By.css('#loginbtn')).click();
  await sleep(2500);
  await ready(d);
  return d;
}
async function ready(d, timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await d.executeScript(`const h=document.documentElement.dataset; return h.kexShell==='ready' && !h.kexNav`).catch(() => false)) return;
    await sleep(100);
  }
}
const js = (d, s, ...a) => d.executeScript(s, ...a);
async function open(d, p) { await d.get(LAB + p); await ready(d); await sleep(2200); }

/** Sample `expr` (returns a number or array) every frame for `ms`; returns [[t, value], ...]. */
async function sample(d, expr, ms) {
  await js(d, `window.__s=[]; const t0=performance.now(); const f=()=>{ try { window.__s.push([Math.round(performance.now()-t0), (${expr})]); } catch { window.__s.push([Math.round(performance.now()-t0), null]); } if (performance.now()-t0<${ms}) requestAnimationFrame(f); }; requestAnimationFrame(f);`);
}
const samples = (d) => js(d, 'return window.__s');

const checks = {
  /** The sidebar course list keeps its width under the pointer, so titles never rewrap; no auto-hide edge or attribute. */
  async sidebar(d) {
    await open(d, '/my/courses.php');
    const rows = () => js(d, `return [...document.querySelectorAll('.kex-sb__course')].slice(0, 8).map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.height), Math.round(r.width)]; })`);
    await d.actions().move({ x: 900, y: 500, origin: Origin.VIEWPORT }).perform();
    const before = await rows();
    await d.actions().move({ x: 120, y: 480, origin: Origin.VIEWPORT, duration: 200 }).perform();
    await sleep(600);
    const during = await rows();
    const edge = await js(d, `return !!document.querySelector('[data-kex-test="sidebar-edge"]') || 'kexSidebarAutoHide' in document.documentElement.dataset`);
    return { ok: JSON.stringify(before) === JSON.stringify(during) && !edge, detail: { before: before.slice(0, 3), during: during.slice(0, 3), edge } };
  },
  /** A page switch from a scrolled course fades in place: the new hero never slides. */
  async pageswitch(d) {
    await open(d, '/course/view.php?id=4');
    await js(d, 'scrollTo({ top: 600, behavior: "instant" })');
    await sleep(400);
    await sample(d, `(() => { const h = [...document.querySelectorAll('[data-kex-test="hero"]')].find((x) => !x.closest('.kex-transition-ghost')); return scrollY === 0 && h ? Math.round(h.getBoundingClientRect().top) : null; })()`, 1500);
    await js(d, `[...document.querySelectorAll('.kex-sb__course')].find((a) => /EMT0140/.test(a.textContent)).click()`);
    await sleep(1700);
    const s = (await samples(d)).map((x) => x[1]).filter((v) => v !== null);
    const final = s.at(-1);
    const off = s.filter((v) => Math.abs(v - final) > 2);
    return { ok: s.length > 10 && off.length === 0, detail: { frames: s.length, final, off: off.slice(0, 5) } };
  },
  /** A topic switch while scrolled deep keeps the topic strip stuck under the header and the new topic right under it. */
  async topicswitch(d) {
    await open(d, '/course/view.php?id=4');
    await js(d, 'scrollTo({ top: 900, behavior: "instant" })');
    await sleep(400);
    await js(d, `document.querySelector('[data-kex-topic="2"]').click()`);
    await sleep(900);
    const r = await js(d, `const s = document.querySelector('[data-kex-test="topics"]').getBoundingClientRect(); const t = document.querySelector('.kex-detail').getBoundingClientRect(); return { y: Math.round(scrollY), strip: Math.round(s.top), gap: Math.round(t.top - s.bottom) }`);
    // The course remembers its last topic; go back to the labs topic for the checks after this one.
    await js(d, `document.querySelector('[data-kex-topic="1"]').click()`);
    await sleep(600);
    return { ok: r.y > 0 && r.strip === 52 && r.gap >= 0 && r.gap <= 40, detail: r };
  },
  /** The side reader opens and closes without moving the row being read. */
  async reader(d) {
    await open(d, '/course/view.php?id=3');
    await js(d, 'scrollTo({ top: 300, behavior: "instant" })');
    await sleep(400);
    const top = () => js(d, `return Math.round(document.querySelector('[data-kex-row]').getBoundingClientRect().top)`);
    const a = await top();
    await js(d, `document.querySelector('[data-kex-row] .kex-row__title a').click()`);
    await sleep(1200);
    const b = await top();
    const side = await js(d, 'return document.documentElement.dataset.kexReader');
    await js(d, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
    await sleep(900);
    const c = await top();
    return { ok: side === 'side' && Math.abs(a - b) <= 2 && Math.abs(a - c) <= 2, detail: { before: a, open: b, closed: c, side } };
  },
  /** Back from an activity (a full page load) returns to the course at the old scroll position. */
  async back(d) {
    await open(d, '/course/view.php?id=4#section-1');
    await js(d, 'scrollTo({ top: 700, behavior: "instant" })');
    await sleep(500);
    // The lab board is short: compare with where the page really was, not with the 700 asked for.
    const was = await js(d, 'return Math.round(scrollY)');
    await js(d, `location.href = document.querySelector('.kex-group--open [data-kex-row] a[href*="/mod/"]').href`);
    await sleep(2500);
    await ready(d);
    await d.navigate().back();
    await sleep(2500);
    await ready(d);
    const y = await js(d, 'return Math.round(scrollY)');
    return { ok: was > 300 && Math.abs(y - was) <= 5, detail: { was, y } };
  },
  /** Back to the Workspace from an activity returns to the same place in the feed, which loads after the page. */
  async backworkspace(d) {
    await open(d, '/my/?view=dossier');
    await js(d, 'scrollTo({ top: 900, behavior: "instant" })');
    await sleep(500);
    const was = await js(d, 'return Math.round(scrollY)');
    await js(d, `location.href = [...document.querySelectorAll('#kex-main a[href*="/mod/"]')].find((a) => a.getBoundingClientRect().top > 0).href`);
    await sleep(2500);
    await ready(d);
    await d.navigate().back();
    await sleep(2500);
    const y = await js(d, 'return Math.round(scrollY)');
    return { ok: was > 300 && Math.abs(y - was) <= 5, detail: { was, y } };
  },
  /** Back to a skinned Moodle page (Participants) keeps the browser's own scroll restore. */
  async backskin(d) {
    await open(d, '/user/index.php?id=4&perpage=5000');
    await js(d, 'scrollTo({ top: 600, behavior: "instant" })');
    await sleep(500);
    const was = await js(d, 'return Math.round(scrollY)');
    await js(d, `location.href = document.querySelector('#participants a[href*="/user/view.php"]').href`);
    await sleep(2500);
    await d.navigate().back();
    await sleep(2500);
    const y = await js(d, 'return Math.round(scrollY)');
    return { ok: was > 200 && Math.abs(y - was) <= 5, detail: { was, y } };
  },
  /** Labs in a wide column: the list beside one open lab; nothing moves once the page has faded in. */
  async labs(d) {
    await open(d, '/course/view.php?id=3');
    await sample(d, `(() => { const q = (s) => document.querySelector(s)?.getBoundingClientRect(); const k = q('.kex-track'), r = q('[data-kex-test="rows"]'), t = q('[data-kex-test="topics"]'); return k && r && t ? [Math.round(k.top), Math.round(k.width), Math.round(r.top), Math.round(t.top)] : null; })()`, 2200);
    await js(d, `[...document.querySelectorAll('.kex-sb__course')].find((a) => /IAS0230/.test(a.textContent)).click()`);
    await sleep(2400);
    const s = (await samples(d)).filter((x) => x[1] && x[0] > 600).map((x) => x[1].join(','));
    const moved = [...new Set(s)];
    const g = await js(d, `return { shown: [...document.querySelectorAll('.kex-group--lab')].filter((e) => e.getBoundingClientRect().height > 0).length, track: Math.round(document.querySelector('.kex-track').getBoundingClientRect().width) }`);
    return { ok: moved.length <= 1 && g.shown === 1 && g.track <= 340, detail: { positions: moved.slice(0, 4), ...g } };
  },
  /** A narrow column keeps the chip strip over folded lab cards. */
  async labsnarrow() {
    const d = await browser(960, 900);
    try {
      await open(d, '/course/view.php?id=4');
      const g = await js(d, `return { chips: Math.round(document.querySelector('.kex-track').getBoundingClientRect().height), folded: [...document.querySelectorAll('.kex-group--lab:not(.kex-group--open)')].filter((e) => e.getBoundingClientRect().height > 0).length }`);
      return { ok: g.chips < 120 && g.folded >= 10, detail: g };
    } finally { await d.quit(); }
  },
  /** On a skinned page TalTech's notice is a KEX card under the band; the original (with its giant SVG) is hidden. */
  async notices(d) {
    await open(d, '/user/index.php?id=4');
    const r = await js(d, `return { cards: document.querySelectorAll('.kex-chrome .kex-notice').length, big: [...document.querySelectorAll('body svg')].filter((s) => !s.closest('#kex-root') && s.getBoundingClientRect().height > 100).length }`);
    return { ok: r.cards >= 1 && r.big === 0, detail: r };
  },
};

// Selenium standalone runs one session at a time: checks that take no browser open their own, after the shared one is closed.
const picked = Object.entries(checks).filter(([name]) => !only || only.includes(name));
const queue = [...picked.filter(([, run]) => run.length > 0), ...picked.filter(([, run]) => run.length === 0)];
let shared;
for (const [name, run] of queue) {
  if (run.length > 0 && !shared) shared = await browser().catch((e) => (results.push({ name, ok: false, detail: `browser: ${e?.message ?? e}` }), undefined));
  if (run.length === 0 && shared) { await shared.quit().catch(() => undefined); shared = undefined; }
  if (run.length > 0 && !shared) { console.log(`FAIL ${name} no browser`); continue; }
  try {
    const r = await run(shared);
    results.push({ name, ...r });
  } catch (e) {
    results.push({ name, ok: false, detail: String(e?.message ?? e).slice(0, 200) });
  }
  const last = results.at(-1);
  console.log(`${last.ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(last.detail)}`);
}
await shared?.quit().catch(() => undefined);
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
