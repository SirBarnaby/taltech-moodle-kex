// The hero shader starts: on the login art and a course hero the shared canvas reaches `live` and draws frames, and with
// effects off it is hidden. Round 8 regression: a display:none fallback rule kept the canvas out of its IntersectionObserver,
// so it never started (deadlock). Run: npm run build:dev && node test/bench/fx-live.mjs   (exit 1 on failure)
import { launch, open } from '../harness/capsite.mjs';

const browser = await launch();
const results = [];
const probe = (page) => page.evaluate(() => {
  const c = document.querySelector('#kex-root .kex-hero__canvas:not(.kex-hero__snap)');
  const host = c?.parentElement;
  return c ? { state: c.dataset.fxState, drawn: !!c.dataset.drawn, opacity: getComputedStyle(c).opacity, display: getComputedStyle(c).display, host: host?.className, mode: host?.dataset.mode } : null;
});
for (const [name, effects] of [['login', 'animated'], ['course-37829', 'animated'], ['login', 'off']]) {
  const page = await open(browser, name, { settings: { effects }, wait: 4000 });
  const got = await probe(page);
  const ok = effects === 'off' ? got && got.opacity === '0' : got && got.state === 'live' && got.drawn && Number(got.opacity) > 0.9;
  results.push({ name, effects, ok: !!ok, got });
  await page.context().close();
}
await browser.close();
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name} effects=${r.effects} ${JSON.stringify(r.got)}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
