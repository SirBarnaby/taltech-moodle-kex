#!/usr/bin/env node
// Visual runner.
//   npm run test:visual                 the geometry specs of test/visual (Playwright)
//   npm run test:visual -- --all        one Chromium screenshot per route of architecture §6, light and dark, in artifacts/pages/
//   npm run test:visual -- --all --only=quiz --theme=dark
// Needs the lab Moodle (http://localhost:8080) and a build: `npm run build:dev`.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { installKex, iter3Seed, LAB, login, root } from '../test/harness/kex.ts';

const args = process.argv.slice(2);
if (!args.includes('--all')) {
  const r = spawnSync('npx', ['playwright', 'test', 'test/visual', ...args], { stdio: 'inherit', cwd: root });
  process.exit(r.status ?? 1);
}

const only = args.find((a) => a.startsWith('--only='))?.slice(7);
const themes = (args.find((a) => a.startsWith('--theme='))?.slice(8) ?? 'light,dark').split(',');
const OUT = path.join(root, 'artifacts/pages');
mkdirSync(OUT, { recursive: true });

const ADMIN = { username: 'admin', password: 'LabAdmin#2026' };
const quiz = 155;

/** group = architecture §6 route key; mode = what KEX must do there. */
const ROUTES = [
  { group: 'login', name: 'lab', mode: 'app', guest: true, path: '/login/index.php', wait: '[data-kex-test="login"]' },
  { group: 'login', name: 'taltech', mode: 'app', guest: true, path: '/login/index.php', capture: 'captures/pages/login_index.html', wait: '[data-kex-test="login"]' },
  { group: 'editing', name: 'course-edit-mode', mode: 'off', admin: true, path: '/course/view.php?id=2', editOn: true },
  { group: 'workspace', name: 'all', mode: 'app', path: '/my/', wait: '[data-kex-test="feed-1"]' },
  { group: 'workspace', name: 'deadlines', mode: 'app', path: '/my/#deadlines', wait: '[data-kex-test="feed-1"]' },
  { group: 'workspace', name: 'updates', mode: 'app', path: '/my/#updates', wait: '[data-kex-test="feed-1"]' },
  { group: 'workspace', name: 'pinned', mode: 'app', path: '/my/#pinned', wait: '[data-kex-test="pinned-page"]' },
  { group: 'mycourses', name: 'current', mode: 'app', path: '/my/courses.php', wait: '[data-kex-test="mc-row-1"]' },
  { group: 'course', name: 'iti8801', mode: 'app', path: '/course/view.php?id=2', wait: '[data-kex-test="course"] [data-kex-test="row-1"]' },
  { group: 'section', name: 'iti8801-topic', mode: 'app', path: 'SECTION', wait: '[data-kex-test="course"]' },
  { group: 'grades', name: 'overview', mode: 'app', path: '/grade/report/overview/index.php', wait: '[data-kex-test="gr-row-1"]' },
  { group: 'notifications', name: 'list', mode: 'app', path: '/message/output/popup/notifications.php', wait: '[data-kex-test="nf-row-1"]' },
  { group: 'quiz-focus', name: 'attempt', mode: 'skin', path: 'QUIZ_ATTEMPT', wait: '#mod_quiz_navblock' },
  { group: 'quiz-focus', name: 'summary', mode: 'skin', path: 'QUIZ_SUMMARY', wait: '.quizsummaryofattempt' },
  { group: 'activity', name: 'resource', mode: 'skin', path: '/mod/resource/view.php?id=161', wait: '[data-kex-test="band"]' },
  { group: 'activity', name: 'url', mode: 'skin', path: '/mod/url/view.php?id=2', wait: '[data-kex-test="urlcard"]' },
  { group: 'activity', name: 'page', mode: 'skin', path: '/mod/page/view.php?id=3', wait: '[data-kex-test="band"]' },
  { group: 'activity', name: 'assign-view', mode: 'skin', path: '/mod/assign/view.php?id=154', wait: '[data-kex-test="band"]' },
  { group: 'activity', name: 'assign-edit', mode: 'skin', path: '/mod/assign/view.php?id=154&action=editsubmission', wait: '#mform1, form.mform' },
  { group: 'activity', name: 'forum-view', mode: 'skin', path: '/mod/forum/view.php?id=34', wait: '[data-kex-test="band"]' },
  { group: 'activity', name: 'forum-discuss', mode: 'skin', path: '/mod/forum/discuss.php?d=1', wait: '.forumpost' },
  { group: 'activity', name: 'quiz-view', mode: 'skin', path: `/mod/quiz/view.php?id=${quiz}`, wait: '[data-kex-test="band"]' },
  { group: 'activity', name: 'book', mode: 'skin', path: '/mod/book/view.php?id=159', wait: '.kex-booktoc' },
  { group: 'activity', name: 'folder', mode: 'skin', path: '/mod/folder/view.php?id=158', wait: '[data-kex-test="band"]' },
  { group: 'activity', name: 'choice', mode: 'skin', path: '/mod/choice/view.php?id=160', wait: '[data-kex-test="band"]' },
  { group: 'grade-user', name: 'course-user', mode: 'skin', path: '/course/user.php?mode=grade&id=2&user=3', wait: 'table.user-grade' },
  { group: 'grade-user', name: 'report-user', mode: 'skin', path: '/grade/report/user/index.php?id=2', wait: 'table.user-grade' },
  { group: 'generic', name: 'calendar-month', mode: 'skin', path: '/calendar/view.php?view=month', wait: 'table.calendarmonth' },
  { group: 'generic', name: 'calendar-upcoming', mode: 'skin', path: '/calendar/view.php?view=upcoming', wait: '.eventlist .event' },
  { group: 'generic', name: 'messages', mode: 'skin', path: '/message/index.php?id=4', wait: '.message-app .message[data-region="message"]' },
  { group: 'generic', name: 'profile', mode: 'skin', path: '/user/profile.php', wait: '.profile_tree' },
  { group: 'generic', name: 'preferences', mode: 'skin', path: '/user/preferences.php', wait: '#page-user-preferences .card' },
  { group: 'generic', name: 'edit-profile', mode: 'skin', path: '/user/edit.php', wait: 'form.mform' },
  { group: 'generic', name: 'participants', mode: 'skin', path: '/user/index.php?id=2', wait: '#participants .kex-role' },
  { group: 'generic', name: 'badges', mode: 'skin', path: '/badges/mybadges.php', wait: 'ul.badges li' },
  { group: 'generic', name: 'catalogue', mode: 'skin', path: '/course/index.php?categoryid=2', wait: '[data-kex-test="band"]' },
  { group: 'generic', name: 'search', mode: 'skin', path: '/course/search.php?search=cloud', wait: '.coursebox .kex-coursecode' },
  { group: 'generic', name: 'private-files', mode: 'skin', path: '/user/files.php', wait: '[data-kex-test="band"]' },
  { group: 'generic', name: 'error', mode: 'skin', path: '/mod/assign/view.php?id=99999', wait: '[data-kex-test="band"]' },
].filter((r) => !only || `${r.group}-${r.name}`.includes(only));

const lab = (cmd) => {
  try {
    execFileSync('sh', ['-c', cmd], { stdio: 'ignore', cwd: root });
  } catch {
    /* docker not reachable: the quiz routes will report it */
  }
};

async function settle(page, wait) {
  await page.waitForFunction(() => ['app', 'skin', 'off'].includes(document.documentElement.dataset.kex ?? ''), null, { timeout: 20_000 });
  if (wait) await page.waitForSelector(wait, { timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !document.documentElement.dataset.kexData || document.documentElement.dataset.kexData === 'idle', null, { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(1600);
}

async function startAttempt(ctx, theme) {
  const p = await ctx.newPage();
  await installKex(p, iter3Seed({ theme, debug: { freezeTime: 7.3 } }));
  await p.goto(`${LAB}/mod/quiz/view.php?id=${quiz}`);
  await p.waitForSelector('[data-kex-test="band"]');
  await p.locator('button:has-text("Attempt quiz"), button:has-text("Continue your attempt"), button:has-text("Re-attempt quiz")').first().click();
  const start = p.locator('.modal.show .modal-footer button:has-text("Start attempt"), #id_submitbutton');
  await start.first().click({ timeout: 4000 }).catch(() => undefined);
  await p.waitForURL(/\/attempt\.php/, { timeout: 20_000 });
  const url = new URL(p.url());
  await p.close();
  return url;
}

const results = [];
const browser = await chromium.launch();
try {
  for (const theme of themes) {
    const seed = iter3Seed({ theme, debug: { freezeTime: 7.3 } });
    const student = await browser.newContext({ viewport: { width: 1585, height: 992 } });
    await login(student);
    const guest = await browser.newContext({ viewport: { width: 1585, height: 992 } });
    const admin = await browser.newContext({ viewport: { width: 1585, height: 992 } });
    let adminIn = false;
    let attempt;
    let section;
    for (const r of ROUTES) {
      const file = path.join(OUT, `${r.group}-${r.name}-${theme}.png`);
      const res = { route: `${r.group}/${r.name}`, theme, ok: false, note: '' };
      results.push(res);
      const ctx = r.guest ? guest : r.admin ? admin : student;
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      try {
        if (r.admin && !adminIn) {
          await login(admin, ADMIN);
          adminIn = true;
        }
        let target = r.path;
        if (target === 'QUIZ_ATTEMPT' || target === 'QUIZ_SUMMARY') {
          attempt ??= await startAttempt(student, theme);
          const u = new URL(attempt.href);
          if (target === 'QUIZ_SUMMARY') {
            u.pathname = u.pathname.replace('attempt.php', 'summary.php');
            u.searchParams.delete('page');
          }
          target = u.pathname + u.search;
        } else if (target === 'SECTION') {
          if (!section) {
            const probe = await student.newPage();
            await probe.goto(`${LAB}/course/view.php?id=2`);
            section = await probe.evaluate(() => document.querySelector('a[href*="/course/section.php?id="]')?.getAttribute('href') ?? '');
            await probe.close();
          }
          target = section || '/course/section.php?id=12';
        }
        await installKex(page, seed);
        if (r.capture) {
          const html = readFileSync(path.join(root, r.capture), 'utf8');
          await page.route(`${LAB}/login/index.php**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
          await page.route('https://moodle.taltech.ee/**', (route) => route.abort());
        }
        if (r.editOn) {
          await page.goto(LAB + r.path);
          const sk = await page.evaluate(() => window.M?.cfg?.sesskey);
          await page.goto(`${LAB}${r.path}&edit=on&sesskey=${sk}`);
        } else {
          await page.goto(/^https?:/.test(target) ? target : LAB + target);
        }
        await settle(page, r.wait);
        const mode = await page.evaluate(() => document.documentElement.dataset.kex);
        res.ok = mode === r.mode;
        res.note = res.ok ? '' : `data-kex=${mode}, expected ${r.mode}`;
        if (errors.length) res.note += ` pageerror: ${errors[0]}`;
        await page.screenshot({ path: file });
        if (r.editOn) {
          const sk = await page.evaluate(() => window.M?.cfg?.sesskey);
          await page.goto(`${LAB}${r.path}&edit=off&sesskey=${sk}`).catch(() => undefined);
        }
      } catch (e) {
        res.note = String(e.message).split('\n')[0];
        await page.screenshot({ path: file }).catch(() => undefined);
      }
      await page.close();
    }
    await student.close();
    await guest.close();
    await admin.close();
  }
} finally {
  await browser.close();
  lab('docker cp tools/lab/m4_reset.php moodle-lab-moodle-1:/tmp/m4_reset.php && docker exec -u nobody moodle-lab-moodle-1 php /tmp/m4_reset.php');
}

for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.theme.padEnd(5)} ${r.route}${r.note ? `  ${r.note}` : ''}`);
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} screenshots in artifacts/pages/`);
process.exit(bad.length ? 1 : 0);
