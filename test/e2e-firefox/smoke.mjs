// Firefox smoke test for the real extension (M0 + M1).
//   node test/e2e-firefox/smoke.mjs [--variant dev|probe] [--only quick|m0|m1|m2|m3|m6|failopen|cssonly|prod|lab45]
// `quick` (<= 90 s, `npm run test:ff`): shell, topic switch and preview, course to course and back, a 960 px pass, the login page under TalTech's width rule, `?kex=off`.
// `lab45` runs against the Moodle 4.5 lab (:8081, Bootstrap 4 markup, language et): guest header, skin surfaces in dark mode, House Rules, subsections.
// Builds + packs the variant, installs it on the Selenium grid and asserts the acceptance checks.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { ADMIN, By, Key, LAB, LAB45, STUDENT, createReporter, lightSurfaces, login, openFirefox, root, sleep, waitFor } from './lib.mjs';

const argv = process.argv.slice(2);
const arg = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const variant = arg('variant', 'dev');
const only = arg('only', 'all');
const want = (g) => only === 'all' || only === g;
const NO_FLASH_PAGES = [
  '/my/', '/my/courses.php', '/course/view.php?id=2', '/mod/forum/view.php?id=34', '/mod/resource/view.php?id=161',
  '/mod/assign/view.php?id=154', '/grade/report/overview/index.php', '/message/output/popup/notifications.php',
  '/user/profile.php', '/calendar/view.php?view=month', '/user/preferences.php',
];

const pack = (kind) => {
  execFileSync('node', ['scripts/pack.mjs', kind], { cwd: root, stdio: 'ignore' });
  return path.join(root, 'dist/packages', { prod: 'kex.xpi', prodlab: 'kex-prod-lab.xpi', dev: 'kex-dev.xpi', probe: 'kex-mv3-probe.xpi', cssonly: 'kex-cssonly.xpi' }[kind]);
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
      await r.check('(c) fonts.check("16px \\"Inter Tight Variable\\"") after fonts.ready, from extension CSS', async () => {
        const d = await driver.executeAsyncScript(`
          const done = arguments[arguments.length - 1];
          document.fonts.ready.then(() => {
            const faces = [...document.fonts].filter((f) => f.family.replace(/"/g,'') === 'Inter Tight Variable');
            done({ check: document.fonts.check('16px "Inter Tight Variable"'), faces: faces.map((f) => f.status), size: document.fonts.size });
          });`);
        if (!d.check) throw new Error('document.fonts.check false');
        if (!d.faces.includes('loaded')) throw new Error(`no loaded Inter Tight Variable face: ${JSON.stringify(d)}`);
        return JSON.stringify(d);
      });
      await r.check('(c2) used font renders as Inter Tight Variable (computed + loaded face)', async () => {
        const fam = await driver.executeScript(`return getComputedStyle(document.querySelector('.kex-sb__name, .kex-crumbs')).fontFamily`);
        if (!/Inter Tight/.test(fam)) throw new Error(fam);
        return fam.slice(0, 50);
      });
    }

    if (want('m1')) await m1Checks(driver, r);
    if (want('m2')) await m2Checks(driver, r);
    if (want('m3')) await m3Checks(driver, r);
    if (want('m6')) await m6Checks(driver, r);
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
  await sleep(3000); // the course page loads topic details and grows a little while it does
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

/**
 * The Moodle 4.5 lab (Bootstrap 4, like the real moodle.taltech.ee) with the Estonian pack: the signed-out header and login button,
 * Moodle's own menus and navigation in dark mode, and the 4.5-only course shapes (a renamed section 0, mod_subsection).
 */
async function lab45() {
  const r = createReporter('firefox Moodle 4.5 lab');
  console.log('\n== Moodle 4.5 lab (Bootstrap 4, et) ==');
  let driver = await openFirefox(pack('dev'), { scheme: 'dark', lang: 'et, en' });
  const sql = (q) => execFileSync('docker', ['exec', 'moodle-lab-45-postgres-1', 'psql', '-U', 'moodle', '-d', 'moodle', '-Atc', q], { encoding: 'utf8' }).trim();
  const cid = (code) => sql(`select id from mdl_course where shortname='${code}'`);
  const forum = sql(`select cm.id from mdl_course_modules cm join mdl_modules m on m.id=cm.module where m.name='forum' and cm.visible=1 order by cm.id limit 1`);
  try {
    await r.check('guest front page: skin with the guest header, a styled login button, Moodle navbar hidden', async () => {
      await driver.get(`${LAB45}/`);
      await waitFor(driver, `document.documentElement.dataset.kexGuest === '1' && !!document.querySelector('[data-kex-test=guest-login]')`, 20000, 'guest header');
      const d = await driver.executeScript(`
        const a = document.querySelector('[data-kex-test=guest-login]'); const c = getComputedStyle(a); const b = a.getBoundingClientRect();
        const nb = document.querySelector('nav.navbar.fixed-top');
        return { mode: document.documentElement.dataset.kex, theme: document.documentElement.dataset.kexTheme, href: a.getAttribute('href'), text: a.textContent.trim(), bg: c.backgroundColor, h: Math.round(b.height), w: Math.round(b.width), nb: nb ? getComputedStyle(nb).display : 'absent', lang: document.documentElement.lang };`);
      if (d.mode !== 'skin' || d.theme !== 'dark') throw new Error(JSON.stringify(d));
      if (!/login\/index\.php/.test(d.href) || !d.text) throw new Error(`login link ${JSON.stringify(d)}`);
      if (d.bg === 'rgba(0, 0, 0, 0)' || d.h < 36 || d.w < 80) throw new Error(`login button not styled ${JSON.stringify(d)}`);
      if (d.nb !== 'none' && d.nb !== 'absent') throw new Error(`Moodle navbar still ${d.nb}`);
      return JSON.stringify(d);
    });
    await r.check('guest header: the language menu lists Moodle\'s languages and the theme toggle flips the theme', async () => {
      await driver.executeScript(`document.querySelector('[data-kex-test=guest-lang]').click()`);
      const items = await waitFor(driver, `(() => { const l = [...document.querySelectorAll('.kex-guest__menu a')].map(a => a.textContent.trim()); return l.length >= 2 ? l : null; })()`, 5000, 'language menu');
      await driver.executeScript(`document.querySelector('[data-kex-test=guest-theme]').click()`);
      const t = await waitFor(driver, `document.documentElement.dataset.kexTheme === 'light' ? 'light' : null`, 5000, 'theme flip');
      await driver.executeScript(`document.querySelector('[data-kex-test=guest-theme]').click()`);
      return `${items.join(' / ')}; ${t}`;
    });
    await r.check('guest password-reset page keeps the guest header', async () => {
      await driver.get(`${LAB45}/login/forgot_password.php`);
      return waitFor(driver, `document.documentElement.dataset.kexGuest === '1' && !!document.querySelector('.kex-guest') ? 'ok' : null`, 20000, 'guest header');
    });

    await login(driver, STUDENT, LAB45);
    await r.check('4.5: shell mounts, Moodle navbar hidden, page language et', async () => {
      await waitFor(driver, `document.documentElement.dataset.kexShell === 'ready' && !!document.querySelector('[data-kex-test=sidebar]')`, 25000, 'shell');
      const lang = await driver.executeScript(`return document.documentElement.lang`);
      if (lang !== 'et') throw new Error(`lang ${lang}`);
      return lang;
    });

    for (const p of [`/mod/forum/view.php?id=${forum}`, '/user/preferences.php', '/calendar/view.php?view=month']) {
      await driver.get(`${LAB45}${p}`);
      await waitFor(driver, `document.documentElement.dataset.kex === 'skin'`, 25000, 'skin');
      await sleep(2000);
      await r.check(`dark ${p}: no light Moodle surface`, async () => {
        const bad = await lightSurfaces(driver);
        if (bad.length) throw new Error(bad.join(', '));
        return 'clean';
      });
    }

    await driver.get(`${LAB45}/course/view.php?id=${cid('ITB8833')}`);
    await r.check('ITB8833: section 0 renamed "House Rules" is the first topic', async () => {
      await waitFor(driver, `!!document.querySelector('[data-kex-test=course]') && document.querySelectorAll('.kex-topiclist li, [data-kex-topic]').length > 1`, 30000, 'course view');
      const d = await driver.executeScript(`return { has: document.querySelector('[data-kex-test=course]').textContent.includes('House Rules'), first: (document.querySelector('[data-kex-topic]') || {}).textContent }`);
      if (!d.has) throw new Error(JSON.stringify(d));
      return (d.first ?? '').trim().slice(0, 60);
    });
    await driver.get(`${LAB45}/course/view.php?id=${cid('SUB0001')}#topic-1`);
    await r.check('SUB0001: the mod_subsection renders as a nested group card with its activities', async () => {
      await waitFor(driver, `document.querySelectorAll('.kex-groupcard').length >= 1`, 30000, 'subsection card');
      const n = await driver.executeScript(`return document.querySelectorAll('.kex-groupcard .kex-row, .kex-groupcard li').length`);
      if (n < 1) throw new Error('subsection card without rows');
      return `${n} rows`;
    });
    // The teacher-only controls (More menu, tertiary selector, Enrol users) need a second browser, signed in as the admin.
    await driver.quit();
    driver = await openFirefox(pack('dev'), { scheme: 'dark', lang: 'et, en' });
    await login(driver, ADMIN, LAB45);
    await driver.get(`${LAB45}/user/index.php?id=${cid('ITI8801')}`);
    await waitFor(driver, `document.documentElement.dataset.kex === 'skin' && !!document.querySelector('.secondary-navigation')`, 25000, 'participants skin');
    await sleep(2500);
    await r.check('dark participants page: no light Moodle surface (secondary navigation, table rows)', async () => {
      const bad = await lightSurfaces(driver);
      if (bad.length) throw new Error(bad.join(', '));
      return 'clean';
    });
    await r.check('secondary navigation: the More menu opens as a dark popover', async () => {
      const opened = await driver.executeScript(`
        const t = [...document.querySelectorAll('.secondary-navigation .dropdown-toggle')].find((e) => e.getBoundingClientRect().width > 0);
        if (!t) return 'no toggle'; t.click(); return 'clicked';`);
      if (opened !== 'clicked') throw new Error(opened);
      const d = await waitFor(driver, `(() => { const m = document.querySelector('.secondary-navigation .dropdown-menu.show'); if (!m || !m.getBoundingClientRect().height) return null; const c = getComputedStyle(m); return { bg: c.backgroundColor, n: m.querySelectorAll('.dropdown-item').length, color: getComputedStyle(m.querySelector('.dropdown-item')).color }; })()`, 5000, 'open menu');
      const lum = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
      if (lum(d.bg) > 0.3 || lum(d.color) < 0.6 || d.n < 2) throw new Error(JSON.stringify(d));
      return JSON.stringify(d);
    });
    await r.check('tertiary navigation selector ("Enrolled users") is readable on the dark surface', async () => {
      const c = await driver.executeScript(`const t = document.querySelector('.tertiary-navigation .dropdown-toggle'); return t ? getComputedStyle(t).color : null`);
      if (!c) throw new Error('no selector');
      const [r, g, b] = c.match(/\d+/g).map(Number);
      if ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.6) throw new Error(c);
      return c;
    });

  } finally {
    await driver.quit();
  }
  failed += r.summary();
}

/**
 * The pre-commit group: one browser, a handful of pages, the things that broke for real.
 * Login page first (signed out), then the shell on /my/, a course, soft navigation, 960 px, and `?kex=off`.
 */
async function quick() {
  const r = createReporter('firefox quick');
  console.log('\n== quick ==');
  const driver = await openFirefox(pack('dev'));
  const shell = (label) => waitFor(driver, `document.documentElement.dataset.kexShell === 'ready' && !!document.querySelector('[data-kex-test=sidebar]')`, 25000, `shell ${label}`);
  try {
    await r.check("login page under TalTech's body.pagelayout-login{width:calc(100% - 640px)}: the body is as wide as the window", async () => {
      await driver.get(`${LAB}/login/index.php`);
      await waitFor(driver, `document.documentElement.dataset.kex === 'app' && !!document.querySelector('[data-kex-test=login]')`, 25000, 'login view');
      await driver.executeScript(`const s = document.createElement('style'); s.textContent = 'body.pagelayout-login{width:calc(100% - 640px)}'; document.head.append(s);`);
      await sleep(300);
      const d = await driver.executeScript(`return { body: Math.round(document.body.getBoundingClientRect().width), view: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }`);
      if (d.body !== d.view || d.scroll > d.view) throw new Error(JSON.stringify(d));
      return JSON.stringify(d);
    });

    await login(driver);
    await r.check('/my/: shell mounted, six courses in the sidebar, Moodle navbar hidden', async () => {
      await driver.get(`${LAB}/my/`);
      await shell('/my/');
      await waitFor(driver, `document.querySelectorAll('.kex-sb__course').length === 6`, 20000, '6 courses');
      const v = await driver.executeScript(`const nb = document.querySelector('nav.navbar, .navbar.fixed-top'); if (!nb) return 'absent'; const b = nb.getBoundingClientRect(); return (getComputedStyle(nb).display === 'none' || getComputedStyle(nb).visibility === 'hidden' || b.height === 0 || b.bottom <= 0) ? 'hidden' : 'VISIBLE'`);
      if (v === 'VISIBLE') throw new Error('navbar visible');
      return v;
    });

    await r.check('course: k switches topic and the hash; Space opens the preview, Esc closes it', async () => {
      await driver.get(`${LAB}/course/view.php?id=2#topic-6`);
      await waitFor(driver, `document.querySelector('[data-kex-test=course] [data-kex-topic="6"][aria-current=true]') && document.querySelectorAll('[data-kex-row]').length > 0`, 30000, 'course page');
      await driver.executeScript(`document.querySelector('[data-kex-topic="6"]').focus()`);
      await driver.actions().sendKeys('k').perform();
      await waitFor(driver, `location.hash === '#topic-5' && document.querySelector('[data-kex-test=detail-kicker]').textContent.trim() === 'TOPIC 05'`, 8000, 'topic 05');
      await driver.executeScript(`document.querySelector('[data-kex-row]').focus()`);
      await driver.actions().sendKeys(' ').perform();
      await waitFor(driver, `!!document.querySelector('[data-kex-test=preview]')`, 8000, 'preview');
      await driver.actions().sendKeys(Key.ESCAPE).perform();
      await waitFor(driver, `!document.querySelector('[data-kex-test=preview]')`, 8000, 'preview closed');
      return 'ok';
    });

    await r.check('course to course through the sidebar, then Back returns to the first course', async () => {
      await driver.get(`${LAB}/course/view.php?id=2`);
      await shell('course 2');
      await waitFor(driver, `!!document.querySelector('[data-kex-test=course]')`, 30000, 'course view');
      const first = await driver.executeScript(`return document.querySelector('[data-kex-test=sb-active-course]')?.dataset.courseId ?? null`);
      const other = await driver.executeScript(`const a = [...document.querySelectorAll('.kex-sb__course[data-course-id]')].find((e) => !e.matches('[data-kex-test=sb-active-course]')); return a ? a.dataset.courseId : null`);
      if (!first || !other) throw new Error(`first ${first}, other ${other}`);
      await driver.executeScript(`document.querySelector('.kex-sb__course[data-course-id="${other}"]').click()`);
      await waitFor(driver, `document.querySelector('[data-kex-test=sb-active-course]')?.dataset.courseId === ${JSON.stringify(other)} && !!document.querySelector('[data-kex-test=course]')`, 30000, 'second course');
      await driver.navigate().back();
      await waitFor(driver, `document.querySelector('[data-kex-test=sb-active-course]')?.dataset.courseId === ${JSON.stringify(first)} && !!document.querySelector('[data-kex-test=course]')`, 30000, 'back to first course');
      return `${first} -> ${other} -> ${first}`;
    });

    await r.check('960 px: workspace and course fit the window without horizontal scroll', async () => {
      await driver.manage().window().setRect({ width: 960, height: 992, x: 0, y: 0 });
      for (const p of ['/my/', '/course/view.php?id=2']) {
        await driver.get(`${LAB}${p}`);
        await shell(p);
        await sleep(2500);
        const d = await driver.executeScript(`return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }`);
        if (d.sw > d.cw) throw new Error(`${p}: ${JSON.stringify(d)}`);
      }
      await driver.manage().window().setRect({ width: 1585, height: 992, x: 0, y: 0 });
      return 'ok';
    });

    await r.check('?kex=off shows plain Moodle and the pill brings KEX back', async () => {
      await driver.get(`${LAB}/my/?kex=off`);
      await waitFor(driver, `document.documentElement.dataset.kex === 'off' && !!document.querySelector('#kex-offpill')`, 15000, 'off + pill');
      await driver.executeScript(`document.querySelector('#kex-offpill .kex-offpill__main').click()`);
      await waitFor(driver, `document.documentElement.dataset.kex === 'app'`, 15000, 'app mode after turning on');
      return 'ok';
    });
  } finally {
    await driver.quit();
  }
  failed += r.summary();
}

try {
  if (only === 'quick') await quick();
  if (only === 'lab45' || only === 'all') await lab45();
  if (only === 'prod') await prodSmoke();
  if (only === 'all' || only === 'm0' || only === 'm1') await m0AndM1(variant);
  if (variant === 'dev' && (only === 'all' || only === 'failopen')) await failOpen();
  if (variant === 'dev' && (only === 'all' || only === 'cssonly')) await cssOnly();
} catch (e) {
  console.error(e);
  failed += 1;
}
process.exit(failed ? 1 : 0);

async function m2Checks(driver, r) {
  await driver.get(`${LAB}/course/view.php?id=2#topic-6`);
  await waitFor(driver, `document.querySelector('[data-kex-test=course] [data-kex-topic="6"][aria-current=true]') && document.querySelectorAll('[data-kex-row]').length === 3`, 30000, 'course page');
  const text = (sel) => driver.executeScript(`return (document.querySelector(${JSON.stringify(sel)})||{}).textContent`);
  await r.check('course: hero title read once by assistive tech', async () => {
    const t = await driver.executeScript(`return [...document.querySelectorAll('[data-kex-test=hero-title] .kex-sr')].map(e => e.textContent)`);
    if (t.length !== 1 || t[0] !== 'Cloud Architectures & DevOps') throw new Error(JSON.stringify(t));
    return t[0];
  });
  await r.check('course: topic 06 shows 3 resources and the topic title', async () => {
    const k = await text('[data-kex-test=detail-kicker]');
    const c = await text('[data-kex-test=detail-count]');
    if (k.trim() !== 'TOPIC 06' || c.trim() !== '3 RESOURCES') throw new Error(`${k} / ${c}`);
    return `${k} / ${c}`;
  });
  await r.check('course: k moves to topic 05 and updates the hash', async () => {
    await driver.executeScript(`document.querySelector('[data-kex-topic="6"]').focus()`);
    await driver.actions().sendKeys('k').perform();
    await waitFor(driver, `location.hash === '#topic-5' && document.querySelector('[data-kex-test=detail-kicker]').textContent.trim() === 'TOPIC 05'`, 8000, 'topic 05');
    return 'ok';
  });
  await r.check('course: secondary navigation shows participants and grades; 1/2/3 do not filter', async () => {
    const keys = await driver.executeScript(`return [...document.querySelectorAll('[data-kex-test=course-nav] a')].map(a => a.dataset.key)`);
    if (!keys.includes('participants') || !keys.includes('grades')) throw new Error(JSON.stringify(keys));
    const before = await driver.executeScript(`return document.querySelectorAll('[data-kex-row]').length`);
    await driver.actions().sendKeys('3').perform();
    await sleep(400);
    const after = await driver.executeScript(`return document.querySelectorAll('[data-kex-row]').length`);
    if (before !== after) throw new Error(`${before} -> ${after}`);
    return keys.join(',');
  });
  await r.check('course: Space opens the preview sheet, Esc closes it', async () => {
    await driver.executeScript(`document.querySelector('[data-kex-row]').focus()`);
    await driver.actions().sendKeys(' ').perform();
    await waitFor(driver, `!!document.querySelector('[data-kex-test=preview]')`, 8000, 'preview');
    await driver.actions().sendKeys(Key.ESCAPE).perform();
    await waitFor(driver, `!document.querySelector('[data-kex-test=preview]')`, 8000, 'preview closed');
    return 'ok';
  });
  await r.check('course: hero canvas is drawn (WebGL2) or falls back without errors', async () => {
    const m = await driver.executeScript(`return document.querySelector('.kex-hero__canvas').dataset.fx`);
    if (!['running', 'paused', 'static', 'fallback'].includes(m)) throw new Error(String(m));
    return m;
  });
}

async function m3Checks(driver, r) {
  await driver.get(`${LAB}/my/`);
  await waitFor(driver, `document.querySelectorAll('[data-kex-test=feed-rows] > li[data-kex-item]').length > 3`, 30000, 'workspace feed');
  await r.check('workspace: overdue rows first, hero label and summary', async () => {
    const f = await driver.executeScript(`return { first: document.querySelector('[data-kex-test=feed-1]').className, label: document.querySelector('[data-kex-test=hero-label]').textContent }`);
    if (!/kex-row--overdue/.test(f.first) || !/^WORKSPACE \//.test(f.label)) throw new Error(JSON.stringify(f));
    return f.label;
  });
  await r.check('workspace: 3 switches to Updates and writes the hash', async () => {
    await driver.actions().sendKeys('3').perform();
    await waitFor(driver, `location.hash === '#updates' && document.querySelector('[data-kex-test=feed-label]').textContent === 'UPDATES'`, 8000, 'updates tab');
    return 'ok';
  });
  await r.check('pinned: the sidebar link switches views in place', async () => {
    await driver.executeScript(`document.querySelector('.kex-sb__nav li:nth-child(2) a').click()`);
    await waitFor(driver, `!!document.querySelector('[data-kex-test=pinned-page]')`, 8000, 'pinned page');
    return 'ok';
  });
  await driver.get(`${LAB}/my/courses.php#all`);
  await r.check('my courses: all six courses listed, filter ignores diacritics', async () => {
    await waitFor(driver, `document.querySelectorAll('[data-kex-mc]').length >= 6`, 30000, 'course rows');
    await driver.actions().sendKeys('f').perform();
    await driver.actions().sendKeys('tarkade asjade vorgud').perform();
    await waitFor(driver, `document.querySelectorAll('[data-kex-mc]').length === 1`, 8000, 'filtered');
    return 'ok';
  });
  await driver.get(`${LAB}/my/`);
  await r.check('palette: "kubernetes" finds materials of two courses after the idle prefetch', async () => {
    await waitFor(driver, `!!document.querySelector('[data-kex-test=workspace]')`, 20000, 'workspace');
    await driver.sleep(6000);
    await driver.actions().keyDown(Key.CONTROL).sendKeys('k').keyUp(Key.CONTROL).perform();
    await waitFor(driver, `!!document.querySelector('[data-kex-test=palette] input')`, 8000, 'palette');
    await driver.actions().sendKeys('kubernetes').perform();
    await waitFor(driver, `(() => { const t = [...document.querySelectorAll('[data-kex-test=palette] [role=option]')].map(e => e.textContent).join('|'); return /ITI8801/.test(t) && /EMT0140/.test(t); })()`, 15000, 'kubernetes results');
    await driver.actions().sendKeys(Key.ESCAPE).perform();
    return 'ok';
  });
}

/** M6: no flash of Moodle's own chrome. The debug build samples every frame from body creation until KEX settles
 *  (src/content/probe.ts); the navbar must never be visible, and the first frame is either hidden by the gate or already KEX. */
async function m6Checks(driver, r) {
  for (const p of NO_FLASH_PAGES) {
    await r.check(`no flash: ${p}`, async () => {
      await driver.get(`${LAB}${p}`);
      const ff = await waitFor(driver, `(() => { try { const v = JSON.parse(sessionStorage.getItem('kex.firstFrame') || 'null'); return v && v.settled !== 'boot' ? v : null; } catch { return null; } })()`, 20000, 'kex.firstFrame');
      if (ff.navbarSeen) throw new Error(`Moodle navbar visible in a frame: ${JSON.stringify(ff)}`);
      const shell = await driver.executeScript(`return !!document.querySelector('#kex-root')`);
      if (ff.first.bodyVisibility !== 'hidden' && !shell) throw new Error(`first frame neither gated nor KEX: ${JSON.stringify(ff)}`);
      return `first body ${ff.first.bodyVisibility}, ${ff.frames} frames, settled ${ff.settled}`;
    });
  }
  await r.check('?kex=off shows plain Moodle and the pill brings KEX back', async () => {
    await driver.get(`${LAB}/my/?kex=off`);
    await waitFor(driver, `document.documentElement.dataset.kex === 'off' && !!document.querySelector('#kex-offpill')`, 15000, 'off + pill');
    await driver.executeScript(`document.querySelector('#kex-offpill .kex-offpill__main').click()`);
    await waitFor(driver, `document.documentElement.dataset.kex === 'app'`, 15000, 'app mode after turning on');
    return 'ok';
  });
}

/** The release build (kex.xpi, minified, no debug hooks) mounts the shell and survives a reload and a few page types. */
async function prodSmoke() {
  const r = createReporter('firefox prod build');
  console.log('\n== prod build (kex.xpi) ==');
  // The shipping xpi may only touch moodle.taltech.ee; the same bundle plus the lab origin is what runs here.
  const shipped = execFileSync('unzip', ['-p', pack('prod'), 'manifest.json'], { encoding: 'utf8' });
  await r.check('kex.xpi manifest: only moodle.taltech.ee, no localhost, no debug id', async () => {
    if (/localhost/.test(shipped)) throw new Error('localhost in the release manifest');
    const m = JSON.parse(shipped);
    if (m.browser_specific_settings.gecko.id !== 'taltech-moodle-kex@kex.local') throw new Error('unexpected id ' + m.browser_specific_settings.gecko.id);
    return JSON.stringify([...m.permissions, ...m.content_scripts[0].matches]);
  });
  const driver = await openFirefox(pack('prodlab'));
  try {
    await login(driver);
    for (const p of ['/my/', '/course/view.php?id=2', '/mod/forum/view.php?id=34', '/grade/report/overview/index.php']) {
      await r.check(`prod: ${p} mounts the KEX shell`, async () => {
        await driver.get(`${LAB}${p}`);
        await waitFor(driver, `['app','skin'].includes(document.documentElement.dataset.kex) && !!document.querySelector('#kex-root .kex-sidebar')`, 25000, 'shell');
        const dbg = await driver.executeScript(`return document.documentElement.dataset.kexTransport ?? null`);
        if (dbg !== null) throw new Error('debug attributes present in the release build');
        return 'ok';
      });
    }
  } finally {
    await driver.quit();
  }
  failed += r.summary();
}
