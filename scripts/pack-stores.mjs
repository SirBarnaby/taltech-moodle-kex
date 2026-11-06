// Store-ready packages, built fresh from the committed source. Nothing is uploaded or signed here.
//
//   node scripts/pack-stores.mjs [--no-verify]
//
// Writes to dist/store/:
//   taltech-moodle-kex-<version>-firefox.zip  upload to addons.mozilla.org (Firefox, MV2)
//   taltech-moodle-kex-<version>-chrome.zip   upload to the Chrome Web Store (Chrome and other Chromium browsers, MV3)
//   taltech-moodle-kex-<version>-source.zip   Mozilla's "source code" upload: the add-on's code is bundled, so reviewers
//                                             rebuild it from this (instructions: store/BUILD.md inside the zip)
// Then, unless --no-verify: unpacks the source zip in a temporary folder, installs the locked dependencies and builds both
// browsers there, and checks every file matches the packages byte for byte (what a store reviewer does).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verify = !process.argv.includes('--no-verify');
const win = process.platform === 'win32';
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const name = `taltech-moodle-kex-${pkg.version}`;
const out = path.join(root, 'dist', 'store');

/** Everything a build reads, and nothing else (no captures, no tests, no personal data). */
const SOURCE = ['package.json', 'package-lock.json', 'tsconfig.json', 'manifest', 'assets', 'src', 'scripts/build.mjs', 'scripts/provenance.mjs', 'scripts/check-css.mjs', 'store/BUILD.md'];

const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, stdio: 'inherit', shell: win });
const read = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, encoding: 'utf8', shell: win }).trim();

const dirty = read('git', ['status', '--porcelain', '--', ...SOURCE]);
if (dirty) throw new Error(`Commit these first; the source zip is made from the last commit:\n${dirty}`);
const commit = read('git', ['rev-parse', '--short', 'HEAD']);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
run('node', ['scripts/build.mjs']);
run('node', ['scripts/build.mjs', '--chrome']);
run(path.join(root, 'node_modules/.bin/web-ext'), ['lint', '-s', 'dist/firefox', '--warnings-as-errors=false', '--output=text']);

const webExt = path.join(root, 'node_modules/.bin/web-ext');
for (const browser of ['firefox', 'chrome']) {
  run(webExt, ['build', '-s', path.join('dist', browser), '-a', out, '--filename', `${name}-${browser}.zip`, '--overwrite-dest']);
}
run('git', ['archive', '--format=zip', `--prefix=${name}-source/`, '-o', path.join(out, `${name}-source.zip`), 'HEAD', '--', ...SOURCE]);

async function hashes(directory, prefix = '') {
  const result = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const rel = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(result, await hashes(path.join(directory, entry.name), rel));
    else if (rel !== 'build-info.json') result[rel] = createHash('sha256').update(await readFile(path.join(directory, entry.name))).digest('hex');
  }
  return result;
}

if (verify) {
  const scratch = await mkdtemp(path.join(tmpdir(), 'kex-source-'));
  try {
    run('git', ['archive', '--format=tar', `--prefix=src-check/`, '-o', path.join(scratch, 'source.tar'), 'HEAD', '--', ...SOURCE]);
    run('tar', ['-xf', 'source.tar'], scratch);
    const tree = path.join(scratch, 'src-check');
    run('npm', ['ci', '--no-audit', '--no-fund', '--ignore-scripts'], tree);
    for (const browser of ['firefox', 'chrome']) {
      run('node', ['scripts/build.mjs', ...(browser === 'chrome' ? ['--chrome'] : [])], tree);
      const [mine, theirs] = await Promise.all([hashes(path.join(root, 'dist', browser)), hashes(path.join(tree, 'dist', browser))]);
      const differ = [...new Set([...Object.keys(mine), ...Object.keys(theirs)])].filter((f) => mine[f] !== theirs[f]);
      if (differ.length) throw new Error(`The ${browser} build from the source zip differs: ${differ.join(', ')}`);
      console.log(`[stores] ${browser}: the source zip rebuilds it byte for byte (${Object.keys(mine).length} files)`);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

console.log(`\n[stores] ${pkg.version} from ${commit}, nothing uploaded:`);
for (const file of await readdir(out)) console.log(`  dist/store/${file}  ${((await stat(path.join(out, file))).size / 1024).toFixed(0)} KB`);
console.log('Publishing steps: store/README.md');
