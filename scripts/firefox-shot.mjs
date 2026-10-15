// Screenshot of the course page in real Firefox (Selenium grid) with the dev build installed: artifacts/visual/iter3/firefox.png.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LAB, login, openFirefox, root, sleep, waitFor } from '../test/e2e-firefox/lib.mjs';

execFileSync('node', ['scripts/pack.mjs', 'dev'], { cwd: root, stdio: 'ignore' });
const driver = await openFirefox(path.join(root, 'dist/packages/kex-dev.xpi'), { width: 1585, height: 1080 });
try {
  await login(driver);
  await driver.get(`${LAB}/course/view.php?id=2#topic-6`);
  await waitFor(driver, `document.querySelector('[data-kex-test=topics-row-6][aria-current=true]') && document.querySelectorAll('[data-kex-row]').length === 3`, 30000, 'course page');
  await sleep(3000); // slide-up and thumbnails settle
  const out = path.join(root, 'artifacts/visual/iter3');
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'firefox.png'), Buffer.from(await driver.takeScreenshot(), 'base64'));
  console.log('wrote artifacts/visual/iter3/firefox.png');
} finally {
  await driver.quit();
}
