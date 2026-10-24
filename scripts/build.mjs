// Build script: bundles content/background/popup/options + CSS, copies fonts/assets, writes manifest.json.
//   node scripts/build.mjs                 -> dist/firefox            (production, MV2)
//   node scripts/build.mjs --dev           -> dist/firefox-dev        (debug flags, localhost patterns)
//   node scripts/build.mjs --dev --mv3-probe -> dist/firefox-mv3-probe (MV3 variant for the M0 matrix)
//   node scripts/build.mjs --dev --css-only  -> dist/firefox-dev-cssonly (no JS: fail-open test)
//   node scripts/build.mjs --lab           -> dist/firefox-prod-lab (release bundle + the lab origin; never shipped)
//   add --watch to rebuild on change (dev only).
import * as esbuild from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCss } from './check-css.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const dev = args.has('--dev');
const watch = args.has('--watch');
const mv3 = args.has('--mv3-probe');
const cssOnly = args.has('--css-only');
// The release bundle (minified, no debug hooks) with the lab's origin added, so the real production code can be tested on http://localhost:8080.
const lab = args.has('--lab');

const outName = mv3 ? 'firefox-mv3-probe' : cssOnly ? 'firefox-dev-cssonly' : lab ? 'firefox-prod-lab' : dev ? 'firefox-dev' : 'firefox';
const out = path.join(root, 'dist', outName);

const FONT_FILES = [
  ['inter', 'inter-latin-wght-normal.woff2'],
  ['inter', 'inter-latin-ext-wght-normal.woff2'],
  ['inter-tight', 'inter-tight-latin-wght-normal.woff2'],
  ['inter-tight', 'inter-tight-latin-ext-wght-normal.woff2'],
  ['jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2'],
  ['jetbrains-mono', 'jetbrains-mono-latin-ext-wght-normal.woff2'],
];

const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const base = JSON.parse(await readFile(path.join(root, 'manifest', 'base.json'), 'utf8'));
const devOverlay = JSON.parse(await readFile(path.join(root, 'manifest', 'dev.json'), 'utf8'));

/** Build the manifest from base.json (+ dev overlay, + MV3 probe). */
function makeManifest() {
  const m = structuredClone(base);
  m.version = pkg.version;
  if (dev || lab) {
    const overlay = devOverlay;
    m.name += overlay.name_suffix;
    m.browser_specific_settings.gecko.id = overlay.gecko_id;
    m.permissions.push(overlay.extra_origin);
    const cs = m.content_scripts[0];
    cs.matches.push(overlay.extra_origin);
    // Mirror the exclusions for the dev origin (Firefox match patterns ignore ports).
    cs.exclude_matches = [
      ...cs.exclude_matches,
      ...cs.exclude_matches.map((p) => p.replace('https://moodle.taltech.ee/', 'http://localhost/')),
    ];
  }
  if (cssOnly) delete m.content_scripts[0].js;
  if (mv3) {
    m.manifest_version = 3;
    const hosts = m.permissions.filter((p) => p.includes('://'));
    m.permissions = m.permissions.filter((p) => !p.includes('://'));
    m.host_permissions = hosts;
    m.action = m.browser_action;
    delete m.browser_action;
    m.background = { scripts: ['background.js'] };
    m.web_accessible_resources = [{ resources: base.web_accessible_resources, matches: m.content_scripts[0].matches }];
  }
  return m;
}

const common = {
  bundle: true,
  format: 'iife',
  target: 'firefox140',
  jsx: 'automatic',
  jsxImportSource: 'preact',
  // Release builds drop whitespace and dead syntax but keep identifiers readable (unlisted signing needs no source review).
  minifyWhitespace: !dev,
  minifySyntax: !dev,
  sourcemap: dev ? 'inline' : false,
  legalComments: 'none',
  logLevel: 'info',
  loader: { '.glsl': 'text', '.svg': 'text' },
  define: {
    __DEBUG__: JSON.stringify(dev),
    __VERSION__: JSON.stringify(pkg.version),
  },
};

async function copyStatic() {
  await mkdir(path.join(out, 'fonts'), { recursive: true });
  for (const [family, file] of FONT_FILES) {
    await cp(path.join(root, 'node_modules/@fontsource-variable', family, 'files', file), path.join(out, 'fonts', file));
  }
  if (existsSync(path.join(root, 'assets'))) await cp(path.join(root, 'assets'), path.join(out, 'assets'), { recursive: true });
  await cp(path.join(root, 'src/popup/popup.html'), path.join(out, 'popup.html'));
  await cp(path.join(root, 'src/options/options.html'), path.join(out, 'options.html'));
  await writeFile(path.join(out, 'manifest.json'), JSON.stringify(makeManifest(), null, 2) + '\n');
}

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const jsEntries = {
  content: 'src/content/index.ts',
  background: 'src/background/index.ts',
  popup: 'src/popup/popup.tsx',
  options: 'src/options/options.tsx',
};

const jsCfg = { ...common, entryPoints: jsEntries, outdir: out, absWorkingDir: root };
const cssCfg = {
  ...common,
  entryPoints: { kex: 'src/styles/index.css', ext: 'src/styles/ext.css' },
  outdir: out,
  absWorkingDir: root,
  sourcemap: false,
  // The @font-face urls are relative to kex.css at runtime (fonts/ is copied next to it).
  external: ['*.woff2', '*.webp', '*.png'],
};

const cssProblems = await checkCss();
if (cssProblems.length) {
  console.error(`CSS check failed:\n  ${cssProblems.join('\n  ')}`);
  process.exit(1);
}

if (watch) {
  const ctxs = await Promise.all([esbuild.context(jsCfg), esbuild.context(cssCfg)]);
  await Promise.all(ctxs.map((c) => c.watch()));
  await copyStatic();
  console.log(`watching -> ${path.relative(root, out)}`);
} else {
  await Promise.all([esbuild.build(jsCfg), esbuild.build(cssCfg)]);
  await copyStatic();
  console.log(`built ${path.relative(root, out)}`);
}
