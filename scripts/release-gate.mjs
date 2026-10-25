// Read-only local validation. Never attaches to a real browser profile or Moodle account.
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root, verifyProvenance } from './provenance.mjs';

const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
const artifacts = path.join(root, 'artifacts', 'releases', runId);
await mkdir(artifacts, { recursive: true });
const report = { schema: 1, runId, status: 'running', startedAt: new Date().toISOString(), checks: [], coverage: 'Isolated local replay; authenticated SSO and submission flows require the manual Firefox smoke check.' };
const env = { ...process.env, KEX_ARTIFACT_DIR: artifacts, KEX_DEMO_DIST: 'firefox', KEX_DEMO_NATIVE_EXTENSION: '0', KEX_DEMO_RUN_ID: runId };

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, resolve); });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function run(name, args) {
  console.log(`[release] ${name}`);
  const started = Date.now();
  let output = '';
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { output += data; });
    child.once('error', reject);
    child.once('close', resolve);
  });
  await writeFile(path.join(artifacts, `${name}.log`), output);
  report.checks.push({ name, exitCode, durationMs: Date.now() - started, log: `${name}.log` });
  if (exitCode !== 0) throw new Error(`${name} failed (${exitCode}).\n${output.slice(-7000)}`);
}

async function screenshotHashes(directory, prefix = '') {
  const files = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(files, await screenshotHashes(path.join(directory, entry.name), relative));
    else if (entry.isFile() && entry.name.endsWith('.png')) files[relative.split(path.sep).join('/')] = createHash('sha256').update(await readFile(path.join(directory, entry.name))).digest('hex');
  }
  return files;
}

try {
  await run('eslint', ['node_modules/eslint/bin/eslint.js', 'src', 'test', 'scripts']);
  await run('typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']);
  await run('unit', ['node_modules/vitest/vitest.mjs', 'run', '--reporter=default', '--reporter=json', `--outputFile.json=${path.join(artifacts, 'unit-results.json')}`]);
  await run('provenance-tests', ['--test', 'test/scripts/provenance.test.mjs']);
  await run('build-local', ['scripts/sync-local.mjs']);
  const build = await verifyProvenance(path.join(root, 'dist/firefox'));
  const installed = await verifyProvenance(root, { exact: false });
  if (installed.buildId !== build.buildId) throw new Error('Root and dist extension builds differ');
  report.buildId = build.buildId;
  report.sourceHash = build.sourceHash;
  await writeFile(path.join(artifacts, 'build-info.json'), `${JSON.stringify(build, null, 2)}\n`);
  await run('manifest', ['node_modules/web-ext/bin/web-ext.js', 'lint', '-s', 'dist/firefox', '--warnings-as-errors=false', '--output=json']);
  env.KEX_DEMO_PORT = String(await availablePort());
  env.KEX_EXPECT_BUILD_ID = build.buildId;
  await run('browser', ['node_modules/@playwright/test/cli.js', 'test', '-c', 'playwright.local.config.ts']);
  const replay = JSON.parse(await readFile(path.join(artifacts, 'replay-build.json'), 'utf8'));
  if (replay.runId !== runId || replay.build.buildId !== build.buildId) throw new Error('Browser tested a different server or build');
  await verifyProvenance(path.join(root, 'dist/firefox'));
  if ((await verifyProvenance(root, { exact: false })).buildId !== build.buildId) throw new Error('Local build changed during validation');
  report.screenshots = await screenshotHashes(artifacts);
  if (Object.keys(report.screenshots).length < 8) throw new Error('Browser evidence is incomplete');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.error = error instanceof Error ? error.message : String(error);
  console.error(report.error);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(artifacts, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[release] ${report.status}: ${path.relative(root, artifacts)}${report.buildId ? ` (${report.buildId})` : ''}`);
}
