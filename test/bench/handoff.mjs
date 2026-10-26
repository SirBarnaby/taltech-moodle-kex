// The sign-in hand-off end to end on the captured pages (round 9): the login notes the sign-in, rushes and eases to white, the
// identity provider is a held redirect to /my/, and the first signed-in page starts white at once, opens My courses in place
// (one page load, the address rewritten), lifts the white while the shell comes in, says "Welcome back", and ends clean. A failed
// sign-in (back on the login page) forgets it. Run: npm run build:dev && node test/bench/handoff.mjs [--shots dir]   (exit 1 on failure)
import { mkdirSync } from 'node:fs';
import { HOST, launch, open } from '../harness/capsite.mjs';

const WWW = `https://${HOST}`;
const args = process.argv.slice(2);
const shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
if (shots) mkdirSync(shots, { recursive: true });
const browser = await launch();
const results = [];
const check = (name, ok, got) => results.push({ name, ok: !!ok, got });

/** Every frame of every page in the context: the white, its opacity, the arrival attribute, the band's welcome. */
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
      white: cs ? cs.backgroundColor : null,
      opacity: cs ? cs.opacity : null,
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
    return { ms: Math.round(performance.now() - a), leaving: document.documentElement.dataset.kexLeaving !== undefined, wash: !!document.getElementById('kex-leave-wash'), saved: s && { fresh: s.t >= before, keys: Object.keys(s).join(',') } };
  });
  await page.waitForTimeout(400);
  if (shots) await page.screenshot({ path: `${shots}/${opts.tag}-1-leaving.png` }).catch(() => undefined);
  await page.waitForURL(/\/my\/courses\.php/, { timeout: 30000, waitUntil: 'load' });
  // What the arrival did, sampled in the page every frame (the harness is too slow to watch it from outside).
  await page.waitForFunction(() => window.__kexLog?.some((f) => f.veil) && !document.getElementById('kex-handoff'), null, { timeout: 15000 }).catch(() => undefined);
  const frames = await page.evaluate(() => window.__kexLog ?? []);
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({
    veil: !!document.getElementById('kex-handoff'),
    url: location.pathname,
    loads: performance.getEntriesByType('navigation').map((n) => new URL(n.name).pathname),
    title: document.title,
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
    const k = [f.path, f.veil, f.opacity, f.arrive, !!f.hello].join(' ');
    if (k !== prev) out.push(`${f.t} ${k}`);
    prev = k;
  }
  return out.join('\n');
};
{
  const r = await signIn({ tag: 'full' });
  if (args.includes('--verbose')) console.log(timeline(r.frames));
  check('leaving: sign-in noted (no picture), rush and white wash on', r.leaving.leaving && r.leaving.wash && r.leaving.saved?.fresh && r.leaving.saved.keys === 't', r.leaving);
  const mine = r.frames.filter((f) => f.path.startsWith('/my/'));
  check('arrival: white from the first frames', mine.slice(0, 3).some((f) => f.veil && /255, 255, 255/.test(f.white ?? '')), mine.slice(0, 3));
  check('arrival: the white lifts (opacity eases down)', mine.some((f) => f.veil && Number(f.opacity) > 0.05 && Number(f.opacity) < 0.95), mine.filter((f) => f.veil).map((f) => f.opacity).join(' '));
  check('arrival: the shell comes in (data-kex-arrive)', mine.some((f) => f.arrive), '');
  check('arrival: welcome line in the band', r.frames.some((f) => /👋/.test(f.hello ?? '')), r.frames.find((f) => f.hello)?.hello);
  check('lands on My courses in place: one page load, address rewritten, its title', r.after.url === '/my/courses.php' && r.after.loads.length === 1 && r.after.loads[0] === '/my/' && /Minu kursused|My courses/.test(r.after.title), { url: r.after.url, loads: r.after.loads, title: r.after.title });
  check('ends clean (no white, attribute, saved note)', !r.after.veil && !r.after.arrive && r.after.saved === null, r.after);
  check('label returns after the welcome', !r.later.hello && r.later.label, r.later);
  check('no page errors', !r.errors.length, r.errors);
}
{
  const r = await signIn({ tag: 'reduced', reducedMotion: 'reduce' });
  check('reduced motion: no rush or wash, no arrival motion, ends clean', !r.leaving.leaving && !r.leaving.wash && r.leaving.saved && !r.frames.some((f) => f.arrive) && !r.after.veil, { leaving: r.leaving, after: r.after });
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
