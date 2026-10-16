// Ad-hoc page probe: load a URL in real Firefox with the dev build, run page-side JS, optionally screenshot.
//   node test/e2e-firefox/probe.mjs --lab 45 --who admin --scheme light --url /admin/search.php --js "document.title" [--shot out.png] [--wait 4000] [--guest-sim] [--click "sel"]
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { ADMIN, LAB, LAB45, STUDENT, login, openFirefox, root, sleep } from './lib.mjs';

const argv = process.argv.slice(2);
const arg = (n, d) => (argv.indexOf(`--${n}`) >= 0 ? argv[argv.indexOf(`--${n}`) + 1] : d);
const lab = arg('lab', '45');
const base = lab === '45' ? LAB45 : LAB;
const who = arg('who', 'student');
const driver = await openFirefox(path.join(root, 'dist/packages/kex-dev.xpi'), { scheme: arg('scheme', 'light'), lang: lab === '45' ? 'et, en' : 'en-US, en' });
try {
  if (who !== 'guest') await login(driver, who === 'admin' ? ADMIN : STUDENT, base);
  for (const url of arg('url', '/').split(',')) {
    await driver.get(base + url);
    await sleep(Number(arg('wait', '3500')));
    if (argv.includes('--guest-sim')) {
      await driver.executeScript(`const h = document.documentElement; if (h.dataset.kex === 'off') { h.dataset.kex = 'skin'; h.dataset.kexGuest = '1'; }`);
      await sleep(300);
    }
    if (arg('click')) {
      for (const sel of arg('click').split('||')) {
        const ok = await driver.executeScript(`const els = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }); if (!els.length) return false; els[0].click(); return true;`);
        console.log(`click ${sel}: ${ok}`);
        await sleep(900);
      }
    }
    if (arg('js')) console.log(JSON.stringify(await driver.executeScript(`return (function(){ ${arg('js')} })()`), null, 1));
    if (arg('shot')) writeFileSync(arg('shot'), Buffer.from(await driver.takeScreenshot(), 'base64'));
  }
} finally {
  await driver.quit();
}
