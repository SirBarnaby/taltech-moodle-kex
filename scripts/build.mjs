// Build script: bundles content/background/popup/options + CSS, copies fonts/assets, writes manifest.json.
//   node scripts/build.mjs                 -> dist/firefox            (production, MV2)
//   node scripts/build.mjs --dev           -> dist/firefox-dev        (debug flags, localhost patterns)
//   node scripts/build.mjs --dev --mv3-probe -> dist/firefox-mv3-probe (MV3 variant for the M0 matrix)
//   node scripts/build.mjs --dev --css-only  -> dist/firefox-dev-cssonly (no JS: fail-open test)
//   node scripts/build.mjs --lab           -> dist/firefox-prod-lab (release bundle + the lab origin; never shipped)
//   node scripts/build.mjs --chrome        -> dist/chrome             (production, MV3 for Chrome and other Chromium browsers)
//   node scripts/build.mjs --chrome --dev  -> dist/chrome-dev         (debug flags, localhost patterns)
//   add --watch to rebuild on change (dev only).
import * as esbuild from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkCss } from './check-css.mjs';
import { buildIdentity, sourceFingerprint, writeProvenance, verifyProvenance } from './provenance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const dev = args.has('--dev');
const watch = args.has('--watch');
const mv3 = args.has('--mv3-probe');
const cssOnly = args.has('--css-only');
// The release bundle (minified, no debug hooks) with the lab's origin added, so the real production code can be tested on http://localhost:8080.
const lab = args.has('--lab');
// The same code for Chrome: an MV3 manifest with a service worker, `browser` mapped onto `chrome`, and stylesheet urls that
// name the extension (Chrome resolves a content script stylesheet's relative urls against the page, Firefox against the add-on).
const chrome = args.has('--chrome');
if (watch && !dev) throw new Error('--watch is only available for development builds');
if (chrome && (mv3 || cssOnly || lab || watch)) throw new Error('--chrome builds only take --dev');

const outName = chrome ? (dev ? 'chrome-dev' : 'chrome') : mv3 ? 'firefox-mv3-probe' : cssOnly ? 'firefox-dev-cssonly' : lab ? 'firefox-prod-lab' : dev ? 'firefox-dev' : 'firefox';
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
const fingerprint = await sourceFingerprint();
const identityOptions = { version: pkg.version, mode: dev ? 'development' : 'production', output: outName, lab, mv3, cssOnly, ...(chrome ? { browser: 'chrome' } : {}) };
const buildId = watch ? 'watch-unverified' : buildIdentity(fingerprint.sourceHash, identityOptions);

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
  if (chrome) return chromeManifest(m);
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

/** Chrome's MV3 manifest from the Firefox one: same name, permissions, content script and pages; no Firefox-only keys. */
function chromeManifest(m) {
  const cs = m.content_scripts[0];
  return {
    manifest_version: 3,
    name: m.name,
    short_name: m.short_name,
    version: m.version,
    description: m.description,
    // CSS nesting without `&`, :has(), container queries, scroll-driven animations, view transitions.
    minimum_chrome_version: '120',
    permissions: m.permissions.filter((p) => !p.includes('://')),
    host_permissions: m.permissions.filter((p) => p.includes('://')),
    background: { service_worker: 'background.js' },
    action: { default_title: m.browser_action.default_title, default_popup: m.browser_action.default_popup, default_icon: m.browser_action.default_icon },
    options_ui: m.options_ui,
    content_scripts: m.content_scripts,
    web_accessible_resources: [{ resources: m.web_accessible_resources, matches: cs.matches }],
    icons: { 16: 'assets/icon-16.png', 32: 'assets/icon-32.png', 48: 'assets/icon-48.png', 128: 'assets/icon-128.png' },
  };
}

const common = {
  bundle: true,
  format: 'iife',
  target: chrome ? 'chrome120' : 'firefox140',
  // Chrome has no `browser` namespace; its MV3 `chrome.*` calls return promises the same way.
  ...(chrome ? { banner: { js: 'globalThis.browser ??= globalThis.chrome;' } } : {}),
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
    __BUILD_ID__: JSON.stringify(buildId),
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
  if (chrome) await pointCssAtExtension();
}

/** Chrome: the content script stylesheet names its fonts and images by the extension's own address (Chrome fills in the id). */
async function pointCssAtExtension() {
  const file = path.join(out, 'kex.css');
  const css = await readFile(file, 'utf8');
  await writeFile(file, css.replace(/url\((["']?)(fonts|assets)\//g, 'url($1chrome-extension://__MSG_@@extension_id__/$2/'));
}

if (!out.startsWith(path.join(root, 'dist') + path.sep)) throw new Error('Unsafe build output');
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
  // Watch builds deliberately never claim release provenance: esbuild may rebuild
  // JS/CSS independently, and static files are copied only at startup.
  await writeFile(path.join(out, 'build-info.json'), JSON.stringify({ schema: 1, state: 'watch-unverified', buildId, ...identityOptions }, null, 2) + '\n');
  console.log(`watching -> ${path.relative(root, out)}`);
} else {
  await Promise.all([esbuild.build(jsCfg), esbuild.build(cssCfg)]);
  await copyStatic();
  if ((await sourceFingerprint()).sourceHash !== fingerprint.sourceHash) throw new Error('Source changed during build; rebuild before using this artifact');
  await writeProvenance(out, { buildId, ...identityOptions }, fingerprint);
  await verifyProvenance(out);
  console.log(`built ${path.relative(root, out)} (${buildId})`);
}
