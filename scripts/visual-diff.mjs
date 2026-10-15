// Pixel diff of the course page against ai_generated_enhanced_drafts/iteration3.png (design-spec §10).
// Usage: node scripts/visual-diff.mjs [--no-build] [--theme=light|dark] [--out=dir]
// Writes artifacts/visual/iter3/{render,side-by-side,overlay,diff}.png and report.json.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { COURSE_ITI, iter3Seed, installKex, login, LAB, root, waitForCourse } from '../test/harness/kex.ts';

const args = new Set(process.argv.slice(2));
const flag = (name, d) => process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? d;
const theme = flag('theme', 'light');
const outDir = path.resolve(root, flag('out', 'artifacts/visual/iter3'));
const MOCK = path.join(root, 'ai_generated_enhanced_drafts/iteration3.png');
const W = 1585;
const H = 992;

/** Regions of the mock (design-spec §10) and their maximum mismatch in percent. */
export const REGIONS = [
  { name: 'sidebar', x: 0, y: 0, w: 246, h: 992, max: 12 },
  { name: 'header', x: 246, y: 0, w: 1339, h: 67, max: 8 },
  { name: 'hero-text', x: 246, y: 67, w: 614, h: 253, max: 10 },
  { name: 'hero-ribbons', x: 860, y: 67, w: 725, h: 253, max: 45, informational: true },
  { name: 'pinned', x: 246, y: 321, w: 1339, h: 112, max: 15 },
  { name: 'materials-header', x: 246, y: 433, w: 1339, h: 68, max: 12 },
  { name: 'topics', x: 262, y: 510, w: 360, h: 400, max: 15 },
  { name: 'detail', x: 640, y: 510, w: 945, h: 482, max: 18 },
];

if (!args.has('--no-build')) {
  const r = spawnSync('node', ['scripts/build.mjs', '--dev'], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, colorScheme: 'light' });
await login(context);
const page = await context.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
await installKex(page, iter3Seed(theme === 'dark' ? { theme: 'dark' } : {}));
await page.goto(`${LAB}/course/view.php?id=${COURSE_ITI}#topic-6`);
await waitForCourse(page);
await page.mouse.move(W - 4, H - 4);
await page.waitForTimeout(250);
const renderPath = path.join(outDir, theme === 'dark' ? 'render-dark.png' : 'render.png');
await page.screenshot({ path: renderPath });
await browser.close();

if (theme === 'dark') {
  console.log(`wrote ${renderPath}`);
  process.exit(0);
}

const mock = PNG.sync.read(readFileSync(MOCK));
const render = PNG.sync.read(readFileSync(renderPath));
if (mock.width !== W || mock.height !== H) throw new Error(`mock is ${mock.width}x${mock.height}`);
if (render.width !== W || render.height !== H) throw new Error(`render is ${render.width}x${render.height}`);

const crop = (png, r) => {
  const out = new PNG({ width: r.w, height: r.h });
  PNG.bitblt(png, out, r.x, r.y, r.w, r.h, 0, 0);
  return out;
};

const report = { generatedAt: new Date().toISOString(), viewport: [W, H], threshold: 0.15, regions: {}, pass: true };
for (const r of REGIONS) {
  const a = crop(mock, r);
  const b = crop(render, r);
  const diff = new PNG({ width: r.w, height: r.h });
  const n = pixelmatch(a.data, b.data, diff.data, r.w, r.h, { threshold: 0.15 });
  const pct = (n / (r.w * r.h)) * 100;
  const ok = pct <= r.max;
  report.regions[r.name] = { mismatchPct: Number(pct.toFixed(2)), maxPct: r.max, pass: ok, informational: !!r.informational };
  if (!ok && !r.informational) report.pass = false;
}

const full = new PNG({ width: W, height: H });
const nAll = pixelmatch(mock.data, render.data, full.data, W, H, { threshold: 0.15 });
report.overall = { mismatchPct: Number(((nAll / (W * H)) * 100).toFixed(2)) };

const side = new PNG({ width: W * 2, height: H });
PNG.bitblt(mock, side, 0, 0, W, H, 0, 0);
PNG.bitblt(render, side, 0, 0, W, H, W, 0);
const overlay = new PNG({ width: W, height: H });
for (let i = 0; i < overlay.data.length; i++) overlay.data[i] = i % 4 === 3 ? 255 : Math.round((mock.data[i] + render.data[i]) / 2);

writeFileSync(path.join(outDir, 'side-by-side.png'), PNG.sync.write(side));
writeFileSync(path.join(outDir, 'overlay.png'), PNG.sync.write(overlay));
writeFileSync(path.join(outDir, 'diff.png'), PNG.sync.write(full));
writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.pass ? 0 : 1;
