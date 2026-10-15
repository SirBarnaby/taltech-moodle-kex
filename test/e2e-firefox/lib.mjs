// Shared helpers for the Selenium Firefox tests (real extension, installed via installAddon).
import { Builder, By, Key, until } from 'selenium-webdriver';
import firefox from 'selenium-webdriver/firefox.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const LAB = 'http://localhost:8080';
export const STUDENT = { username: 'student', password: 'Student#2026' };
export const SELENIUM = process.env.SELENIUM_URL ?? 'http://localhost:4444';
export { By, Key, until };

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Open a Firefox session on the Selenium grid and install an .xpi as a temporary add-on. */
export async function openFirefox(xpi, { width = 1585, height = 992 } = {}) {
  const options = new firefox.Options();
  options.setPreference('extensions.autoDisableScopes', 0);
  options.setPreference('intl.accept_languages', 'en-US, en');
  const driver = await new Builder().forBrowser('firefox').usingServer(SELENIUM).setFirefoxOptions(options).build();
  await driver.manage().window().setRect({ width, height, x: 0, y: 0 });
  if (xpi) await driver.installAddon(xpi, true);
  return driver;
}

/** Log in through the real form. Leaves the browser on /my/. */
export async function login(driver, who = STUDENT) {
  await driver.get(`${LAB}/login/index.php`);
  const username = await driver.wait(until.elementLocated(By.css('#username')), 15000);
  await driver.wait(until.elementIsVisible(username), 15000); // CSS-only builds keep the page hidden for up to 4 s
  await driver.findElement(By.css('#username')).sendKeys(who.username);
  await driver.findElement(By.css('#password')).sendKeys(who.password);
  await driver.findElement(By.css('#loginbtn')).click();
  await driver.wait(until.urlContains('/my/'), 20000);
}

/** Poll a page-side predicate (string expression) until it returns truthy. */
export async function waitFor(driver, expr, timeout = 15000, label = expr) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < timeout) {
    try {
      last = await driver.executeScript(`return (${expr});`);
      if (last) return last;
    } catch (e) {
      last = String(e);
    }
    await sleep(100);
  }
  throw new Error(`timeout waiting for ${label} (last: ${JSON.stringify(last)})`);
}

export function createReporter(name) {
  const results = [];
  return {
    results,
    async check(label, fn) {
      try {
        const detail = await fn();
        results.push({ label, ok: true, detail });
        console.log(`  PASS ${label}${detail !== undefined && detail !== true ? `  (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''}`);
      } catch (e) {
        results.push({ label, ok: false, detail: e instanceof Error ? e.message : String(e) });
        console.log(`  FAIL ${label}: ${e instanceof Error ? e.message : e}`);
      }
    },
    summary() {
      const failed = results.filter((r) => !r.ok).length;
      console.log(`${name}: ${results.length - failed}/${results.length} passed`);
      return failed;
    },
  };
}
