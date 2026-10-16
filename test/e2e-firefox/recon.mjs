// Skin recon: screenshots a list of Moodle pages (and open menus / modals) in real Firefox with the dev build installed.
//   node test/e2e-firefox/recon.mjs --lab 45|53 --scheme light|dark --who guest|student|admin [--only <substr>] [--out artifacts/round2]
// Writes <out>/<lab>-<scheme>/<who>-<name>.png and <out>/<lab>-<scheme>/<who>-report.json (kex mode, html lang, title).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ADMIN, LAB, LAB45, STUDENT, login, openFirefox, root, sleep, waitFor } from './lib.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : d);
const lab = arg('lab', '45');
const scheme = arg('scheme', 'light');
const who = arg('who', 'student');
const only = arg('only', '');
const guestSim = argv.includes('--guest-sim'); // simulate the proposed guest skin: data-kex=skin + data-kex-guest (index.ts does not set it yet)
const out = path.resolve(root, arg('out', 'artifacts/round2'), `${lab}-${scheme}`);
const base = lab === '45' ? LAB45 : LAB;
const pg = lab === '45' ? 'moodle-lab-45-postgres-1' : 'moodle-lab-postgres-1';
mkdirSync(out, { recursive: true });

const sql = (q) => execFileSync('docker', ['exec', pg, 'psql', '-U', 'moodle', '-d', 'moodle', '-Atc', q], { encoding: 'utf8' }).trim();
const cm = (mod) => sql(`select cm.id from mdl_course_modules cm join mdl_modules m on m.id=cm.module where m.name='${mod}' and cm.deletioninprogress=0 and cm.visible=1 order by cm.id limit 1`);
const disc = sql('select id from mdl_forum_discussions order by id limit 1');
const sub = lab === '45' ? sql(`select id from mdl_course where shortname='SUB0001'`) : '';

/** Click the first visible element matching one of the selectors. */
const click = async (d, sel) => d.executeScript(`
  const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
  if (!els.length) return false; els[0].click(); return true;`);


/** In-page audit: elements that still carry Moodle's own look (light surfaces in dark mode, Moodle blue, non-KEX fonts). */
const AUDIT = `
const dark = document.documentElement.dataset.kexTheme === 'dark';
const lum = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); if (a < 0.5) return null; return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
const BLUES = ['rgb(15, 108, 191)', 'rgb(0, 123, 255)', 'rgb(17, 119, 209)', 'rgb(0, 86, 179)', 'rgb(0, 105, 217)', 'rgb(13, 110, 253)', 'rgb(51, 122, 183)'];
const key = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].slice(0, 4).map((c) => '.' + c).join('');
const out = {};
const add = (e, why) => { const k = why + ' ' + key(e); out[k] = (out[k] || 0) + 1; };
for (const e of document.querySelectorAll('body *')) {
  if (e.closest('#kex-root, .kex-offpill, script, style, svg, [hidden]')) continue;
  const r = e.getBoundingClientRect();
  if (r.width < 6 || r.height < 6) continue;
  const c = getComputedStyle(e);
  if (c.display === 'none' || c.visibility === 'hidden') continue;
  if (dark && r.width * r.height > 300) { const l = lum(c.backgroundColor); if (l !== null && l > 0.8) add(e, 'LIGHT-BG'); }
  if (BLUES.includes(c.backgroundColor)) add(e, 'BLUE-BG');
  if (BLUES.includes(c.color) && e.children.length === 0 && e.textContent.trim()) add(e, 'BLUE-TEXT');
  if (BLUES.includes(c.borderTopColor) && parseFloat(c.borderTopWidth) > 0) add(e, 'BLUE-BORDER');
  if (e.children.length === 0 && e.textContent.trim() && !/Inter|JetBrains|FontAwesome|Font Awesome/i.test(c.fontFamily) && !e.closest('.fa, .icon, [class*=icon], iframe')) add(e, 'FONT(' + c.fontFamily.split(',')[0].slice(0, 20) + ')');
}
return out;`;

const GUEST = [
  ['front', '/'],
  ['login', '/login/index.php'],
  ['login-forgot', '/login/forgot_password.php'],
  ['courses-index', '/course/index.php'],
  ['course-guest', '/course/view.php?id=3'],
  ['course-info', '/course/info.php?id=3'],
  ['enrol-redirect', '/enrol/index.php?id=3'],
  ['forum-redirect', `/mod/forum/view.php?id=${cm('forum')}`],
  ['front-user-menu', '/', (d) => click(d, '.usermenu a.login, a[href*="login/index.php"]')],
];

const STUDENT_PAGES = [
  ['dashboard', '/my/'],
  ['mycourses', '/my/courses.php'],
  ['profile', '/user/profile.php'],
  ['profile-view', '/user/view.php?id=3&course=2'],
  ['preferences', '/user/preferences.php'],
  ['pref-edit', '/user/edit.php'],
  ['pref-password', '/login/change_password.php'],
  ['pref-language', '/user/language.php'],
  ['pref-forum', '/user/forum.php'],
  ['pref-editor', '/user/editor.php'],
  ['pref-contentbank', '/user/contentbank.php'],
  ['pref-calendar', '/user/calendar.php'],
  ['pref-notifications', '/message/notificationpreferences.php'],
  ['pref-messaging', '/message/edit.php?id=3'],
  ['pref-badges', '/badges/preferences.php'],
  ['pref-blog', '/blog/preferences.php'],
  ['pref-tokens', '/user/managetoken.php'],
  ['pref-portfolio', '/user/portfolio.php'],
  ['pref-datareq', '/admin/tool/dataprivacy/mydatarequests.php'],
  ['calendar-month', '/calendar/view.php?view=month'],
  ['calendar-upcoming', '/calendar/view.php?view=upcoming'],
  ['calendar-day', '/calendar/view.php?view=day'],
  ['calendar-new-event', '/calendar/view.php?view=month', async (d) => { await click(d, '[data-action="new-event-button"]'); await sleep(2500); }],
  ['calendar-export', '/calendar/export.php'],
  ['privatefiles', '/user/files.php'],
  ['privatefiles-picker', '/user/files.php', async (d) => { await click(d, '.fp-btn-add a, .fp-btn-add'); await sleep(2500); }],
  ['messages', '/message/index.php'],
  ['messages-drawer', '/my/', async (d) => { await click(d, '[data-region="popover-region-messages"] a, #message-drawer-toggle, [data-action="show-message-drawer"], .nav-link[href*="message"]'); await sleep(2500); }],
  ['notifications', '/message/output/popup/notifications.php'],
  ['notification-popover', '/user/files.php', async (d) => { await click(d, '#popover-region-notification a, [data-region="popover-region-notifications"] a'); await sleep(2000); }],
  ['grades-overview', '/grade/report/overview/index.php'],
  ['badges', '/badges/mybadges.php'],
  ['badge-view', '/badges/mybadges.php', async (d) => { await click(d, '.badge-name a, .card a[href*="badge"]'); await sleep(1500); }],
  ['course', '/course/view.php?id=2'],
  ['course-house-rules', '/course/view.php?id=6'],
  ['course-subsection', `/course/view.php?id=${sub || 8}`],
  ['course-section', '/course/section.php?id=11'],
  ['participants', '/user/index.php?id=2'],
  ['grades-user', '/grade/report/user/index.php?id=2'],
  ['competencies', '/admin/tool/lp/coursecompetencies.php?courseid=2'],
  ['badges-course', '/badges/view.php?type=2&id=2'],
  ['course-more-menu', '/user/index.php?id=2', async (d) => { await click(d, '.moremenu .dropdown-toggle, .secondary-navigation .dropdown-toggle, button[data-toggle="dropdown"][aria-label*="More"], .moremenu button'); await sleep(800); }],
  ['forum', `/mod/forum/view.php?id=${cm('forum')}`],
  ['forum-discussion', `/mod/forum/discuss.php?d=${disc}`],
  ['forum-actionmenu', `/mod/forum/discuss.php?d=${disc}`, async (d) => { await click(d, '.action-menu .dropdown-toggle, .dropdown-toggle[data-toggle="dropdown"], [data-bs-toggle="dropdown"]'); await sleep(800); }],
  ['forum-reply', `/mod/forum/discuss.php?d=${disc}`, async (d) => { await click(d, '[data-action="collapsible-link"], a[data-post-id][title*="Reply"], a[href*="reply"]'); await sleep(1500); }],
  ['assign', `/mod/assign/view.php?id=${cm('assign')}`],
  ['quiz', `/mod/quiz/view.php?id=${cm('quiz')}`],
  ['page', `/mod/page/view.php?id=${cm('page')}`],
  ['url', `/mod/url/view.php?id=${cm('url')}`],
  ['folder', `/mod/folder/view.php?id=${cm('folder')}`],
  ['book', `/mod/book/view.php?id=${cm('book')}`],
  ['choice', `/mod/choice/view.php?id=${cm('choice')}`],
  ['glossary', `/mod/glossary/view.php?id=${cm('glossary')}`],
  ['wiki', `/mod/wiki/view.php?id=${cm('wiki')}`],
  ['feedback', `/mod/feedback/view.php?id=${cm('feedback')}`],
  ['resource', `/mod/resource/view.php?id=${cm('resource')}`],
  ['search', '/search/index.php?q=cloud'],
  ['user-menu-open', '/user/profile.php', async (d) => { await click(d, '#user-menu-toggle, .usermenu .dropdown-toggle, .kex-usermenu button, [data-kex-test=user-menu]'); await sleep(800); }],
];

const ADMIN_PAGES = [
  ['course-settings', '/course/edit.php?id=2'],
  ['course-admin', '/course/admin.php?courseid=2'],
  ['course-editing', '/course/view.php?id=2&edit=on'],
  ['course-settings-menu', '/course/view.php?id=2', async (d) => { await click(d, '.secondary-navigation .moremenu .dropdown-toggle, .secondary-navigation .dropdown-toggle'); await sleep(800); }],
  ['participants-admin', '/user/index.php?id=2'],
  ['enrolments', '/enrol/instances.php?id=2'],
  ['gradebook-setup', '/grade/edit/tree/index.php?id=2'],
  ['grader-report', '/grade/report/grader/index.php?id=2'],
  ['questionbank', '/question/edit.php?courseid=2'],
  ['logs-report', '/report/log/index.php?id=2'],
  ['reports', '/course/admin.php?courseid=2#linkcoursereports'],
  ['competencies-admin', '/admin/tool/lp/coursecompetencies.php?courseid=2'],
  ['backup', '/backup/backup.php?id=2'],
  ['restore', '/backup/restorefile.php?contextid=' + sql(`select id from mdl_context where contextlevel=50 and instanceid=2`)],
  ['assign-edit', `/course/modedit.php?update=${cm('assign')}`],
  ['assign-grading', `/mod/assign/view.php?id=${cm('assign')}&action=grading`],
  ['quiz-edit', `/mod/quiz/edit.php?cmid=${cm('quiz')}`],
  ['forum-admin', `/mod/forum/view.php?id=${cm('forum')}`],
  ['admin-home', '/admin/search.php'],
  ['admin-notifications', '/admin/index.php'],
  ['admin-users', '/admin/user.php'],
  ['admin-roles', '/admin/roles/manage.php'],
  ['admin-plugins', '/admin/plugins.php'],
  ['admin-themesettings', '/admin/settings.php?section=themesettingtaltech4_boost'],
  ['course-management', '/course/management.php'],
  ['site-front-edit', '/?redirect=0'],
  ['more-menu', '/user/index.php?id=2', async (d) => { await click(d, '.secondary-navigation .dropdownmoremenu > a, .secondary-navigation [data-region="morebutton"] > a'); await sleep(900); }],
  ['tertiary-dropdown', '/user/index.php?id=2', async (d) => { await click(d, '.tertiary-navigation .dropdown-toggle, .tertiary-navigation button[data-toggle="dropdown"]'); await sleep(900); }],
  ['enrol-modal', '/user/index.php?id=2', async (d) => { await click(d, '[data-action="showenrolmentmodal"], .enrolusersbutton button, .enrolusersbutton a'); await sleep(2500); }],
  ['users-actionmenu', '/admin/user.php', async (d) => { await click(d, '.action-menu .dropdown-toggle, .dropdown-toggle.icon-no-margin, [data-toggle="dropdown"]'); await sleep(900); }],
  ['users-filters-modal', '/admin/user.php', async (d) => { await click(d, 'button[data-action="filters"], .btn[data-action*="filter"], #page-admin-user .btn-secondary'); await sleep(2500); }],
  ['gradebook-add-dropdown', '/grade/edit/tree/index.php?id=2', async (d) => { await click(d, '.tertiary-navigation .dropdown-toggle, .btn-group .dropdown-toggle, [data-toggle="dropdown"]'); await sleep(900); }],
  ['assign-grading-actionmenu', `/mod/assign/view.php?id=${cm('assign')}&action=grading`, async (d) => { await click(d, '.action-menu .dropdown-toggle, [data-toggle="dropdown"]'); await sleep(900); }],
  ['course-mgmt-actionmenu', '/course/management.php', async (d) => { await click(d, '.action-menu .dropdown-toggle, [data-toggle="dropdown"]'); await sleep(900); }],
  ['delete-modal', '/user/index.php?id=2', async (d) => { await click(d, 'a[title*="nrol"], a.unenrollink, [data-action=unenrol]'); await sleep(2500); }],
];

const pages = { guest: GUEST, student: STUDENT_PAGES, admin: [...STUDENT_PAGES.slice(0, 3), ...ADMIN_PAGES] }[who];
const driver = await openFirefox(path.join(root, 'dist/packages/kex-dev.xpi'), { scheme, lang: lab === '45' ? 'et, en' : 'en-US, en' });
const report = [];
try {
  if (who !== 'guest') await login(driver, who === 'admin' ? ADMIN : STUDENT, base);
  for (const [name, p, act] of pages) {
    if (only && !name.includes(only)) continue;
    try {
      await driver.get(base + p);
      await sleep(1500);
      await waitFor(driver, `document.documentElement.dataset.kexShell === 'ready' || document.documentElement.dataset.kex === 'off' || document.readyState === 'complete' && !document.documentElement.dataset.kex`, 9000).catch(() => undefined);
      await sleep(2500);
      if (guestSim && who === 'guest') {
        await driver.executeScript(`const h = document.documentElement; if (h.dataset.kex === 'off') { h.dataset.kex = 'skin'; h.dataset.kexGuest = '1'; }`);
        await sleep(300);
      }
      if (act) await act(driver);
      const info = await driver.executeScript(`return { kex: document.documentElement.dataset.kex, theme: document.documentElement.dataset.kexTheme, lang: document.documentElement.lang, title: document.title, path: location.pathname + location.search, body: document.body.id }`);
      const audit = await driver.executeScript(AUDIT).catch((e) => ({ error: String(e) }));
      await driver.executeScript('window.scrollTo(0,0)');
      writeFileSync(path.join(out, `${who}-${name}.png`), Buffer.from(await driver.takeScreenshot(), 'base64'));
      report.push({ name, ...info, audit });
      console.log(`${name}: ${info.kex} ${info.body} ${info.path}`);
    } catch (e) {
      console.log(`${name}: ERROR ${e.message.split('\n')[0]}`);
      report.push({ name, error: e.message.split('\n')[0] });
    }
  }
} finally {
  writeFileSync(path.join(out, `${who}-report.json`), JSON.stringify(report, null, 1));
  await driver.quit();
}
