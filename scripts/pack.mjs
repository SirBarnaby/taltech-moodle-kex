// Packs a build into an installable .xpi under dist/packages/. Usage: node scripts/pack.mjs <prod|dev|probe|cssonly>
import { execFileSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const kind = process.argv[2] ?? 'prod';
const variants = {
  prod: { flags: [], dir: 'firefox', file: 'kex.xpi' },
  dev: { flags: ['--dev'], dir: 'firefox-dev', file: 'kex-dev.xpi' },
  probe: { flags: ['--dev', '--mv3-probe'], dir: 'firefox-mv3-probe', file: 'kex-mv3-probe.xpi' },
  cssonly: { flags: ['--dev', '--css-only'], dir: 'firefox-dev-cssonly', file: 'kex-cssonly.xpi' },
};
const v = variants[kind];
if (!v) throw new Error(`unknown pack kind "${kind}" (${Object.keys(variants).join(', ')})`);

const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });
run('node', ['scripts/build.mjs', ...v.flags]);
const outDir = path.join(root, 'dist', 'packages');
await mkdir(outDir, { recursive: true });
run(path.join(root, 'node_modules/.bin/web-ext'), ['build', '-s', path.join('dist', v.dir), '-a', outDir, '--filename', v.file, '--overwrite-dest']);
console.log(`packed -> dist/packages/${v.file}`);
