// Live testing in the tester's own Firefox (round 10): a small WebDriver client for geckodriver, driving a separate Firefox profile
// with the built add-on installed, against live moodle.taltech.ee. Nothing here borrows the tester's normal profile: the test
// profile lives in .scratch/ff-live-profile and is signed in once by the tester themselves (Claude never types credentials).
//
//   node test/live/wd.mjs start            start geckodriver and Firefox (or reuse the running ones), install dist/firefox
//   node test/live/wd.mjs reload           install dist/firefox again (after npm run build) and reload the page
//   node test/live/wd.mjs place X Y W H    move the test window
//   node test/live/wd.mjs url | shot FILE | exec -e CODE | quit
//
// Environment: KEX_FIREFOX_BINARY, KEX_GECKODRIVER (found with Selenium Manager when unset), KEX_LIVE_PORT (default 4455).
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SCRATCH = path.join(ROOT, '.scratch');
const STATE = path.join(SCRATCH, 'live', 'session.json');
const PROFILE = path.join(SCRATCH, 'ff-live-profile');
const PORT = Number(process.env.KEX_LIVE_PORT ?? 4455);
const BASE = `http://127.0.0.1:${PORT}`;
export const ADDON = path.join(ROOT, 'dist', 'firefox');
export const WWW = 'https://moodle.taltech.ee';

const FIREFOXES = [
  process.env.KEX_FIREFOX_BINARY,
  'C:\\DevTools\\Mozilla Firefox\\firefox.exe',
  'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
  'C:\\Program Files\\Firefox Developer Edition\\firefox.exe',
  '/usr/bin/firefox',
  '/Applications/Firefox.app/Contents/MacOS/firefox',
].filter(Boolean);

export async function call(method, p, body) {
  const r = await fetch(BASE + p, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json();
  if (j.value && j.value.error) throw new Error(`${j.value.error}: ${j.value.message}`);
  return j.value;
}

const sid = () => JSON.parse(readFileSync(STATE, 'utf8')).id;
export const S = (p) => `/session/${sid()}${p}`;
export const exec = (script, args = []) => call('POST', S('/execute/sync'), { script, args });
export const execAsync = (script, args = []) => call('POST', S('/execute/async'), { script, args });
export const nav = (url) => call('POST', S('/url'), { url });
export const url = () => call('GET', S('/url'));
export const actions = (list) => call('POST', S('/actions'), { actions: list });
export async function shot(out) {
  const b64 = await call('GET', S('/screenshot'));
  writeFileSync(out, Buffer.from(b64, 'base64'));
  return out;
}
export const installAddon = () => call('POST', S('/moz/addon/install'), { path: ADDON, temporary: true });
export const place = (x, y, width, height) => call('POST', S('/window/rect'), { x, y, width, height });

async function driverUp() {
  try {
    await fetch(`${BASE}/status`);
    return true;
  } catch {
    return false;
  }
}

function geckodriverPath() {
  if (process.env.KEX_GECKODRIVER) return process.env.KEX_GECKODRIVER;
  const bin = path.join(ROOT, 'node_modules', 'selenium-webdriver', 'bin', process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux', process.platform === 'win32' ? 'selenium-manager.exe' : 'selenium-manager');
  const firefox = FIREFOXES.find((f) => existsSync(f));
  const out = execFileSync(bin, ['--browser', 'firefox', ...(firefox ? ['--browser-path', firefox] : []), '--output', 'json'], { encoding: 'utf8' });
  return JSON.parse(out).result.driver_path;
}

async function sessionAlive() {
  if (!existsSync(STATE)) return false;
  try {
    await url();
    return true;
  } catch {
    return false;
  }
}

/** geckodriver and the test Firefox, started once and reused by every later script. */
export async function ensureSession() {
  if (!(await driverUp())) {
    const child = spawn(geckodriverPath(), ['--port', String(PORT), '--host', '127.0.0.1'], { detached: true, stdio: 'ignore' });
    child.unref();
    for (let i = 0; i < 50 && !(await driverUp()); i++) await new Promise((r) => setTimeout(r, 100));
  }
  if (await sessionAlive()) return false;
  const binary = FIREFOXES.find((f) => existsSync(f));
  mkdirSync(PROFILE, { recursive: true });
  mkdirSync(path.dirname(STATE), { recursive: true });
  const v = await call('POST', '/session', {
    capabilities: { alwaysMatch: { browserName: 'firefox', 'moz:firefoxOptions': { ...(binary ? { binary } : {}), args: ['-profile', PROFILE] } } },
  });
  writeFileSync(STATE, JSON.stringify({ id: v.sessionId }));
  await installAddon();
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'start') {
    const fresh = await ensureSession();
    if (!fresh) await installAddon();
    await nav(`${WWW}/my/courses.php`);
    console.log(fresh ? 'started' : 'reused', await url());
  } else if (cmd === 'reload') {
    await ensureSession();
    await installAddon();
    await exec('location.reload()');
    console.log('reloaded', await url());
  } else if (cmd === 'place') {
    console.log(await place(...rest.map(Number)));
  } else if (cmd === 'url') {
    console.log(await url());
  } else if (cmd === 'shot') {
    console.log(await shot(rest[0]));
  } else if (cmd === 'exec') {
    const code = rest[0] === '-e' ? rest.slice(1).join(' ') : readFileSync(rest[0], 'utf8');
    console.log(JSON.stringify(await exec(code), null, 1));
  } else if (cmd === 'quit') {
    if (existsSync(STATE)) await call('DELETE', `/session/${sid()}`).catch((e) => console.log(String(e)));
  } else {
    console.log('usage: node test/live/wd.mjs start | reload | place X Y W H | url | shot FILE | exec -e CODE | quit');
  }
}
