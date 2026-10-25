// Opt-in: the tester runs this command and signs in themselves in a fresh Firefox profile.
// No personal profile, credentials, cookies, screenshots or Moodle response bodies are saved.
import { Builder } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import { createInterface } from 'node:readline/promises';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root, verifyProvenance } from './provenance.mjs';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('npm run test:live -- [--course 37582]\nOpens a separate Firefox profile. Sign in manually, then press Enter in this terminal. Only read-only page navigation and link inspection follow.');
  process.exit(0);
}
const courseAt = args.indexOf('--course');
const course = courseAt >= 0 ? Number(args[courseAt + 1]) : undefined;
if (course !== undefined && (!Number.isSafeInteger(course) || course < 1)) throw new Error('--course requires a Moodle course ID');
const build = await verifyProvenance(path.join(root, 'dist/firefox'));
const options = new firefox.Options();
if (process.env.KEX_FIREFOX_BINARY) options.setBinary(process.env.KEX_FIREFOX_BINARY);
const builder = new Builder().forBrowser('firefox').setFirefoxOptions(options);
if (process.env.KEX_GECKODRIVER) builder.setFirefoxService(new firefox.ServiceBuilder(process.env.KEX_GECKODRIVER));
const terminal = createInterface({ input: process.stdin, output: process.stdout });
const report = { schema: 1, buildId: build.buildId, startedAt: new Date().toISOString(), checks: [], status: 'running' };
let driver;
try {
  driver = await builder.build(); // Selenium creates its own temporary profile.
  await driver.installWebExtension(path.join(root, 'dist/firefox'), { permanent: false });
  await driver.get('https://moodle.taltech.ee/login/index.php');
  await terminal.question('Sign in using your usual SSO in this separate Firefox window. When Moodle opens, press Enter here. ');
  const pages = ['/my/courses.php', '/my/?view=dossier', ...(course ? [`/course/view.php?id=${course}`] : [])];
  for (const page of pages) {
    await driver.get(`https://moodle.taltech.ee${page}`);
    await driver.wait(async () => driver.executeScript('return document.documentElement.dataset.kexShell === "ready" && !document.documentElement.dataset.kexInteraction && !document.documentElement.dataset.kexNav'), 20_000);
    const result = await driver.executeScript(`
      return { buildId: document.documentElement.dataset.kexBuild,
        authenticated: !location.pathname.includes('/login/'),
        mounted: !!document.querySelector('.kex-main'),
        nativeActivities: document.querySelectorAll('a[href*="/mod/assign/view.php"], a[href*="/mod/quiz/view.php"]').length,
        ghosts: document.querySelectorAll('.kex-transition-ghost').length };
    `);
    const passed = result.authenticated && result.mounted && result.buildId === build.buildId && result.ghosts === 0;
    report.checks.push({ page: page.startsWith('/course/') ? 'course' : page, passed, ...result });
    if (!passed) throw new Error(`Smoke check failed on ${page.startsWith('/course/') ? 'course' : page}`);
  }
  console.log('In the course, check a long topic, Back/Forward, a material reader, and an assignment or quiz view. Do not submit anything for this smoke test.');
  const manual = (await terminal.question('Did SSO, native activity links and these interactions work? Type pass or fail: ')).trim().toLowerCase();
  report.checks.push({ name: 'tester-confirmed SSO and native activity links', passed: manual === 'pass' });
  report.status = manual === 'pass' ? 'passed' : 'failed';
  if (manual !== 'pass') process.exitCode = 1;
} catch (error) {
  report.status = 'failed';
  // WebDriver errors can contain authenticated page source; do not persist them.
  console.error(error instanceof Error ? error.message.split('\n')[0] : 'Live smoke check failed');
  process.exitCode = 1;
} finally {
  terminal.close();
  await driver?.quit().catch(() => undefined);
  const directory = path.join(root, 'artifacts', 'live-smoke', new Date().toISOString().replace(/[:.]/g, '-'));
  await mkdir(directory, { recursive: true });
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Live smoke ${report.status}: ${path.relative(root, directory)}`);
}
