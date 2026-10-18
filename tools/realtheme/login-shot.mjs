import { writeFileSync } from 'node:fs';
import { openFirefox, sleep } from '/home/claude/kex-codex/test/e2e-firefox/lib.mjs';
const [xpi, out, w = '1585', h = '992'] = process.argv.slice(2);
const d = await openFirefox(xpi, { width: +w, height: +h });
try {
  await d.get('http://localhost:8099/login.html');
  await sleep(6000);
  const info = await d.executeScript(`const b=document.body,r=document.querySelector('#kex-root');return {kex:document.documentElement.dataset.kex,view:document.documentElement.dataset.kexView,bodyW:b.getBoundingClientRect().width,rootW:r&&r.getBoundingClientRect().width,vw:innerWidth}`);
  console.log(JSON.stringify(info));
  writeFileSync(out, Buffer.from(await d.takeScreenshot(), 'base64'));
} finally { await d.quit(); }
