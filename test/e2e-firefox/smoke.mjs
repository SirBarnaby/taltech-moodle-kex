// Firefox smoke test for the real extension (M0 + M1).
//   node test/e2e-firefox/smoke.mjs [--variant dev|probe] [--only m0|m1|failopen|cssonly]
// Builds + packs the variant, installs it on the Selenium grid and asserts the acceptance checks.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { By, Key, LAB, createReporter, login, openFirefox, root, sleep, waitFor } from './lib.mjs';

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const variant = arg('variant', 'dev');
const only = arg('only', 'all');
const want = (g) => only === 'all' || only === g;

const pack = (kind) => {
  execFileSync('node', ['scripts/pack.mjs', kind], { cwd: root, stdio: 'ignore' });
  return path.join(root, 'dist/packages', { dev: 'kex-dev.xpi', probe: 'kex-mv3-probe.xpi', cssonly: 'kex-cssonly.xpi' }[kind]);
};

let failed = 0;

async function m0AndM1(kind) {
  const r = createReporter(`firefox ${kind === 'probe' ? 'MV3-probe' : 'MV2'} smoke`);
  console.log(`\n== ${kind === 'probe' ? 'MV3 probe' : 'MV2'}: M0 + M1 checks ==`);
  const driver = await openFirefox(pack(kind));
  try {
    await login(driver);
    // Let the extension settle on /my/.
    await driver.get(`${LAB}/my/`);

    if (want('m0') || only === 'all') {
      await r.check('(a) html[data-kex] is set on /my/', async () =>
        waitFor(driver, 'document.documentElement.dataset.kex', 10000, 'data-kex'));
      await r.check('(b) ws.call returns 6 courses via content.fetch', async () => {
        await waitFor(driver, 'document.documentElement.dataset.kexCourses', 20000, 'kexCourses');
        const d = await driver.executeScript('return {n: document.documentElement.dataset.kexCourses, t: document.documentElement.dataset.kexTransport}');
        if (d.n !== '6') throw new Error(`courses=${d.n}`);
        if (d.t !== 'content.fetch') throw new Error(`transport=${d.t}`);
        return `courses=${d.n} transport=${d.t}`;
      });
      await r.check('(c) fonts.check("16px \\"Inter Variable\\"") after fonts.ready, from extension CSS', async () => {
        const d = await driver.executeAsyncScript(`
          const done = arguments[arguments.length - 1];
          document.fonts.ready.then(() => {
            const faces = [...document.fonts].filter((f) => f.family.replace(/"/g,'') === 'Inter Variable');
            done({ check: document.fonts.check('16px "Inter Variable"'), faces: faces.map((f) => f.status), size: document.fonts.size });
          });`);
        if (!d.check) throw new Error('document.fonts.check false');
        if (!d.faces.includes('loaded')) throw new Error(`no loaded Inter Variable face: ${JSON.stringify(d)}`);
        return JSON.stringify(d);
      });
      await r.check('(c2) used font renders as Inter Variable (computed + loaded face)', async () => {
        const fam = await driver.executeScript(`return getComputedStyle(document.querySelector('.kex-sb__name, .kex-crumbs')).fontFamily`);
        if (!/Inter/.test(fam)) throw new Error(fam);
        return fam.slice(0, 50);
      });
    }

    if (want('m1')) await m1Checks(driver, r);
  } finally {
    await driver.quit();
  }
  failed += r.summary();
}

async function m1Checks(driver, r) {
  const shell = (p) => waitFor(driver, `document.documentElement.dataset.kexShell === 'ready' && document.querySelector('[data-kex-test=sidebar]') && !!document.querySelector('[data-kex-test=sb-active-course], [data-kex-test=sidebar] a')`, 20000, `shell on ${p}`);
  const routes = ['/my/', '/course/view.php?id=2', '/mod/forum/view.php?id=33', `/user/profile.php`];
  for (const p of routes) {
    await driver.get(LAB + p);
    await r.check(`${p}: shell mounted`, () => shell(p));
    await r.check(`${p}: sidebar lists 6 courses with codes`, async () => {
      await waitFor(driver, `document.querySelectorAll('.kex-sb__course').length === 6`, 20000, '6 courses');
      const codes = await driver.executeScript(`return [...document.querySelectorAll('.kex-sb__course .kex-sb__code:not(.kex-sb__code--rail)')].map(e => e.textContent.trim())`);
      if (codes.length !== 6 || codes.some((c) => !c)) throw new Error(JSON.stringify(codes));
      return codes.join(',');
    });
    await r.check(`${p}: Moodle navbar not visible`, async () => {
      const v = await driver.executeScript(`
        const nb = document.querySelector('nav.navbar, .navbar.fixed-top');
        if (!nb) return 'absent';
        const s = getComputedStyle(nb); const b = nb.getBoundingClientRect();
        return (s.display === 'none' || s.visibility === 'hidden' || b.height === 0 || b.bottom <= 0) ? 'hidden' : 'VISIBLE';`);
      if (v === 'VISIBLE') throw new Error('navbar visible');
      return v;
    });
    await r.check(`${p}: breadcrumb present`, async () => {
      const t = await driver.executeScript(`return [...document.querySelectorAll('[data-kex-test=breadcrumb] .kex-crumbs__item')].map(e=>e.textContent.trim()).filter(Boolean)`);
      if (!t.length) throw new Error('empty breadcrumb');
      return t.join(' > ');
    });
    if (p.includes('course/view') || p.includes('mod/forum')) {
      await r.check(`${p}: active course highlighted`, async () => {
        const n = await driver.executeScript(`return document.querySelectorAll('[data-kex-test=sb-active-course]').length`);
        if (n !== 1) throw new Error(`active count ${n}`);
        return true;
      });
    }
  }

  // header compression on a course page
  await driver.get(`${LAB}/course/view.php?id=2`);
  await shell('course');
  await r.check('header height 67 at scrollY=0, 52 after 300px, scrollHeight unchanged', async () => {
    const m = () => driver.executeScript(`return { h: document.querySelector('[data-kex-test=header]').getBoundingClientRect().height, sh: document.documentElement.scrollHeight, y: scrollY }`);
    const a = await m();
    await driver.executeScript('window.scrollTo(0, 300)');
    await sleep(700);
    const b = await m();
    if (Math.abs(a.h - 67) > 1) throw new Error(`top ${a.h}`);
    if (b.y < 100) throw new Error(`page not scrollable (scrollY ${b.y}, sh ${b.sh})`);
    if (Math.abs(b.h - 52) > 1) throw new Error(`scrolled ${b.h}`);
    if (a.sh !== b.sh) throw new Error(`scrollHeight ${a.sh} -> ${b.sh}`);
    await driver.executeScript('window.scrollTo(0, 0)');
    return `${a.h} -> ${b.h}, scrollHeight ${a.sh}`;
  });

  // palette
  await driver.get(`${LAB}/my/`);
  await shell('/my/');
  await r.check('Ctrl+K opens the palette with the input focused (not stolen by the browser)', async () => {
    await driver.findElement(By.css('body')).click().catch(() => undefined);
    await driver.actions().keyDown(Key.CONTROL).sendKeys('k').keyUp(Key.CONTROL).perform();
    await waitFor(driver, `document.querySelector('[data-kex-test=palette]')`, 5000, 'palette');
    const f = await waitFor(driver, `document.activeElement && document.activeElement.closest('[data-kex-test=palette]') && document.activeElement.tagName`, 3000, 'input focus');
    return f;
  });
  await r.check('typing "iti" puts ITI8801 first; Enter navigates', async () => {
    await driver.actions().sendKeys('iti').perform();
    await sleep(300);
    const first = await driver.executeScript(`const o=document.querySelector('[data-kex-test=palette] [role=option]'); return o && o.textContent`);
    if (!/ITI8801/.test(first ?? '')) throw new Error(`first=${first}`);
    await driver.actions().sendKeys(Key.ENTER).perform();
    await waitFor(driver, `location.pathname.includes('/course/view.php')`, 15000, 'navigation');
    return first.trim().slice(0, 40);
  });
  await shell('course after palette');
  await r.check('Esc closes the palette and restores focus', async () => {
    await driver.executeScript(`document.activeElement && document.activeElement.blur(); document.querySelector('[data-kex-test=search]').focus();`);
    await driver.actions().keyDown(Key.CONTROL).sendKeys('k').keyUp(Key.CONTROL).perform();
    await waitFor(driver, `document.querySelector('[data-kex-test=palette]')`, 5000, 'palette');
    await driver.actions().sendKeys(Key.ESCAPE).perform();
    await waitFor(driver, `!document.querySelector('[data-kex-test=palette]')`, 3000, 'palette closed');
    return waitFor(driver, `document.activeElement && document.activeElement.getAttribute('data-kex-test') === 'search'`, 3000, 'focus restored');
  });

  // theme
  await r.check('`t` flips data-kex-theme; reload keeps it', async () => {
    const before = await driver.executeScript(`return document.documentElement.dataset.kexTheme`);
    await driver.executeScript(`document.activeElement && document.activeElement.blur()`);
    await driver.actions().sendKeys('t').perform();
    await sleep(300);
    const after = await driver.executeScript(`return document.documentElement.dataset.kexTheme`);
    if (before === after) throw new Error(`theme stayed ${before}`);
    await driver.navigate().refresh();
    await shell('reload');
    const again = await driver.executeScript(`return document.documentElement.dataset.kexTheme`);
    if (again !== after) throw new Error(`after reload ${again}, expected ${after}`);
    // restore
    await driver.actions().sendKeys('t').perform();
    await sleep(300);
    return `${before} -> ${after} -> reload ${again}`;
  });
}

async function failOpen() {
  const r = createReporter('firefox fail-open');
  console.log('\n== fail-open ==');
  const driver = await openFirefox(pack('dev'));
  try {
    await login(driver);
    await r.check('?kex-test-throw=shell leaves Moodle visible with the error pill', async () => {
      await driver.get(`${LAB}/my/?kex-test-throw=shell`);
      await waitFor(driver, `document.documentElement.dataset.kex === 'off'`, 10000, 'data-kex=off');
      const d = await driver.executeScript(`
        const p = document.getElementById('kex-offpill');
        return { bodyVis: getComputedStyle(document.body).visibility, pill: p && p.dataset.variant, pillVisible: !!p && getComputedStyle(p).display !== 'none', navVisible: !!document.querySelector('#page, #page-wrapper') && document.querySelector('#page, #page-wrapper').getBoundingClientRect().height > 100 };`);
      if (d.bodyVis !== 'visible') throw new Error(JSON.stringify(d));
      if (d.pill !== 'error' || !d.pillVisible) throw new Error(JSON.stringify(d));
      return JSON.stringify(d);
    });
  } finally {
    await driver.quit();
  }
  failed += r.summary();
}

async function cssOnly() {
  const r = createReporter('firefox CSS-only');
  console.log('\n== CSS-only (no JS injected) ==');
  const driver = await openFirefox(pack('cssonly'));
  try {
    await login(driver);
    await r.check('CSS-only build reveals Moodle within 4.2 s of the gate starting (and was hidden before)', async () => {
      await driver.get(`${LAB}/my/`);
      let hiddenSeen = false;
      let gateStart = null; // performance.now() at which the gate animation started (first style resolution of <body>)
      for (;;) {
        const v = await driver.executeScript(`
          const a = document.body ? document.body.getAnimations().find((x) => x.animationName === 'kex-failsafe') : null;
          const now = performance.now();
          return { kex: document.documentElement.dataset.kex || null, vis: document.body ? getComputedStyle(document.body).visibility : 'nobody', now: Math.round(now), start: a ? Math.round(now - a.currentTime) : null, nav: Math.round(performance.getEntriesByType('navigation')[0].responseStart) };`);
        if (v.vis === 'hidden') {
          hiddenSeen = true;
          if (v.start !== null) gateStart = v.start;
        }
        if (v.vis === 'visible') {
          if (v.kex !== null) throw new Error('JS ran in the CSS-only build');
          if (!hiddenSeen) throw new Error('never observed hidden: the CSS gate is not active');
          const since = v.now - (gateStart ?? 0);
          if (since > 4200) throw new Error(`visible ${since} ms after the gate started (${v.now} ms after navigation start)`);
          return `visible ${since} ms after the gate started (${v.now} ms after navigation start; server TTFB ${v.nav} ms)`;
        }
        if (v.now > 9000) throw new Error(`still hidden after ${v.now} ms`);
        await sleep(40);
      }
    });
  } finally {
    await driver.quit();
  }
  failed += r.summary();
}

try {
  if (only === 'all' || only === 'm0' || only === 'm1') await m0AndM1(variant);
  if (variant === 'dev' && (only === 'all' || only === 'failopen')) await failOpen();
  if (variant === 'dev' && (only === 'all' || only === 'cssonly')) await cssOnly();
} catch (e) {
  console.error(e);
  failed += 1;
}
process.exit(failed ? 1 : 0);
