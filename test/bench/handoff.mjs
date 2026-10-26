// The sign-in hand-off end to end on the captured pages: the login saves its last frame and rushes, the identity provider is a
// held redirect to /my/ (which itself redirects to My courses), and the first signed-in page shows the frame at once, closes it
// in on the band with points of light, says "Welcome back", and ends clean. A failed sign-in (back on the login page) forgets
// the frame. Run: npm run build:dev && node test/bench/handoff.mjs [--shots dir]   (exit 1 on failure)
import { mkdirSync } from 'node:fs';
import { HOST, launch, open } from '../harness/capsite.mjs';

const WWW = `https://${HOST}`;
const args = process.argv.slice(2);
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (shots) mkdirSync(shots, { recursive: true });
const browser = await launch();
const results = [];
const check = (name, ok, got) => results.push({ name, ok: !!ok, got });

/** Every frame of every page in the context: veil, its clip and opacity, sparks, arrival attribute, the band's welcome. */
const LOGGER = () => {
  if (window.top !== window) return;
  const t0 = performance.now();
  const log = (window.__kexLog = []);
  const sample = () => {
    const v = document.getElementById('kex-handoff');
    const cs = v && getComputedStyle(v);
    log.push({
      t: Math.round(performance.now() - t0),
      path: location.pathname,
      veil: !!v,
      clip: cs ? cs.clipPath : null,
      opacity: cs ? cs.opacity : null,
      sparks: !!document.querySelector('canvas.kex-sparks'),
      arrive: document.documentElement?.dataset.kexArrive !== undefined,
      hello: document.querySelector('[data-kex-test="band-hello"]')?.textContent ?? null,
    });
    if (log.length < 2000) requestAnimationFrame(sample);
  };
  sample();
};

async function signIn(opts) {
  // A smaller window keeps the software-rendered ribbons (and so the frame capture) quick enough here.
  const page = await open(browser, 'login', { wait: 3000, viewport: { width: 1100, height: 700 }, ...opts });
  const errors = [];
  // (The captured pages' own inline scripts fail without Moodle's JavaScript: not ours.)
  page.on('pageerror', (e) => /js_pending|help_popups|\bM is not defined|require is not defined/.test(String(e)) || errors.push(String(e)));
  await page.addInitScript(LOGGER);
  // The identity provider takes a while and then sends the reader to Moodle's default destination. (A page that redirects,
  // not a 302: Chromium sends a fulfilled redirect's next request past the interception.) It is not a Moodle page, so it must
  // pass the frame on.
  await page.route(`${WWW}/auth/**`, async (r) => {
    await new Promise((res) => setTimeout(res, 2500));
    await r.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><title>Signing in</title><script>location.replace(${JSON.stringify(`${WWW}/my/`)})</script>` });
  });
  // Clicked from the page: the saving runs in the click handler, which software GL (this harness) makes slow. The state is
  // read in the same task, before the identity provider answers.
  const leaving = await page.evaluate(() => {
    const a = performance.now();
    const before = Date.now();
    document.querySelector('[data-kex-test="login-idp"][data-primary="true"]').click();
    const s = JSON.parse(sessionStorage.getItem('kex-handoff') ?? 'null');
    return { ms: Math.round(performance.now() - a), leaving: document.documentElement.dataset.kexLeaving !== undefined, saved: s && { fresh: s.t >= before, img: (s.img ?? '').slice(0, 15), kb: Math.round((s.img ?? '').length / 1024) } };
  });
  await page.waitForTimeout(400);
  if (shots) await page.screenshot({ path: `${shots}/${opts.tag}-1-leaving.png` }).catch(() => undefined);
  await page.waitForURL(/\/my\/courses\.php/, { timeout: 30000, waitUntil: 'load' });
  // What the arrival did, sampled in the page every frame (the harness is too slow to watch it from outside).
  await page.waitForFunction(() => window.__kexLog?.some((f) => f.veil) && !document.getElementById('kex-handoff') && !document.querySelector('canvas.kex-sparks'), null, { timeout: 15000 }).catch(() => undefined);
  const frames = await page.evaluate(() => window.__kexLog ?? []);
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({
    veil: !!document.getElementById('kex-handoff'),
    sparks: !!document.querySelector('canvas.kex-sparks'),
    arrive: document.documentElement.dataset.kexArrive !== undefined,
    saved: sessionStorage.getItem('kex-handoff'),
    hello: document.querySelector('[data-kex-test="band-hello"]')?.textContent ?? null,
    label: document.querySelector('[data-kex-test="band-label"]')?.textContent ?? null,
  }));
  if (shots) await page.screenshot({ path: `${shots}/${opts.tag}-3-after.png` });
  await page.waitForTimeout(5000);
  const later = await page.evaluate(() => ({ hello: !!document.querySelector('[data-kex-test="band-hello"]'), label: !!document.querySelector('[data-kex-test="band-label"]') }));
  await page.context().close();
  return { leaving, frames, after, later, errors };
}

const timeline = (frames) => {
  let prev = '';
  const out = [];
  for (const f of frames) {
    const k = [f.veil, f.clip?.slice(0, 22), f.sparks, f.arrive, !!f.hello].join(' ');
    if (k !== prev) out.push(`${f.t} ${k}`);
    prev = k;
  }
  return out.join('\n');
};
{
  const r = await signIn({ tag: 'full' });
  if (args.includes('--verbose')) console.log(timeline(r.frames));
  check('leaving: frame saved, rush on', r.leaving.leaving && r.leaving.saved?.fresh && r.leaving.saved.img.startsWith('data:image/'), r.leaving);
  const clips = r.frames.filter((f) => f.veil && f.clip && f.clip !== 'none');
  check('arrival: veil from the first frames', r.frames.slice(0, 3).some((f) => f.veil), r.frames.slice(0, 3));
  check('arrival: veil closes in (clip-path)', clips.some((f) => /inset\((?!0px 0px 0px 0px)/.test(f.clip)), clips.map((f) => `${f.t}:${f.clip}`).slice(0, 6));
  check('arrival: points of light', r.frames.some((f) => f.sparks), r.frames.map((f) => f.sparks).join(''));
  check('arrival: welcome line in the band', r.frames.some((f) => /👋/.test(f.hello ?? '')), r.frames.find((f) => f.hello)?.hello);
  check('ends clean (no veil, sparks, attribute, saved frame)', !r.after.veil && !r.after.sparks && !r.after.arrive && r.after.saved === null, r.after);
  check('label returns after the welcome', !r.later.hello && r.later.label, r.later);
  check('no page errors', !r.errors.length, r.errors);
}
{
  const r = await signIn({ tag: 'reduced', reducedMotion: 'reduce' });
  check('reduced motion: no rush, no clip, no sparks, ends clean', !r.leaving.leaving && r.leaving.saved && !r.frames.some((f) => f.sparks || (f.clip && f.clip !== 'none')) && !r.after.veil, { leaving: r.leaving, after: r.after });
}
async function reloadWith(name, saved) {
  const page = await open(browser, name, { wait: 1500 });
  await page.evaluate((v) => sessionStorage.setItem('kex-handoff', JSON.stringify(v)), saved);
  await page.reload({ waitUntil: 'commit' });
  const first = await page.evaluate(() => !!document.getElementById('kex-handoff')).catch(() => null);
  await page.waitForTimeout(1500);
  const got = await page.evaluate(() => ({ veil: !!document.getElementById('kex-handoff'), saved: sessionStorage.getItem('kex-handoff') }));
  await page.context().close();
  return { first, ...got };
}
{
  // A sign-in that came back to the login page (wrong password): the frame is forgotten, nothing covers the login.
  const got = await reloadWith('login', { t: Date.now() });
  check('failed sign-in: no veil on the login page, frame forgotten', !got.first && !got.veil && got.saved === null, got);
}
{
  // A stale frame (an old tab) is never shown.
  const got = await reloadWith('mycourses', { t: Date.now() - 20 * 60 * 1000 });
  check('stale frame: not shown, forgotten', !got.first && !got.veil && got.saved === null, got);
}
await browser.close();
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name} ${JSON.stringify(r.got)}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
