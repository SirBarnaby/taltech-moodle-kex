// Renders assets/icon-{16,32,48,96}.png from an inline SVG using Playwright's Chromium. Run: node scripts/make-icons.mjs
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = (s) => `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 96 96">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a2790"/><stop offset="1" stop-color="#150b4f"/></linearGradient></defs>
<rect x="4" y="4" width="88" height="88" rx="22" fill="url(#g)"/>
<rect x="14" y="12" width="68" height="64" rx="14" fill="#ffffff" fill-opacity=".12"/>
<path d="M33 26v40M33 47l22-21M39 41l20 25" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="30" y="76" width="36" height="5" rx="2.5" fill="#a10982"/></svg>`;
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const s of [16, 32, 48, 96]) {
  await page.setViewportSize({ width: s, height: s });
  await page.setContent(`<body style="margin:0;background:transparent">${svg(s)}</body>`);
  const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: s, height: s } });
  await writeFile(path.join(root, 'assets', `icon-${s}.png`), buf);
}
await browser.close();
