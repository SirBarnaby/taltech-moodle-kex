// Content hashes identify exactly what was built, including dirty local source.
// Captures, browser profiles, credentials and student data are never inputs here.
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const slash = (value) => value.split(path.sep).join('/');
const inputTrees = ['src', 'manifest', 'assets'];
const inputFiles = ['package.json', 'package-lock.json', 'tsconfig.json', 'scripts/build.mjs', 'scripts/provenance.mjs'];

async function filesIn(directory, prefix = '') {
  const out = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Build input/output must not be a symlink: ${relative}`);
    if (entry.isDirectory()) out.push(...await filesIn(path.join(directory, entry.name), relative));
    else if (entry.isFile()) out.push(slash(relative));
  }
  return out.sort();
}

export async function sourceFingerprint() {
  const names = [...inputFiles];
  for (const tree of inputTrees) names.push(...(await filesIn(path.join(root, tree))).map((name) => `${tree}/${name}`));
  const inputs = {};
  for (const name of names.sort()) inputs[name] = digest(await readFile(path.join(root, name)));
  return { sourceHash: digest(JSON.stringify(inputs)), inputs };
}

export function buildIdentity(sourceHash, options) {
  return digest(JSON.stringify({ sourceHash, ...options })).slice(0, 24);
}

export async function writeProvenance(directory, metadata, fingerprint) {
  const files = {};
  for (const name of await filesIn(directory)) {
    if (name !== 'build-info.json') files[name] = digest(await readFile(path.join(directory, name)));
  }
  const info = { schema: 1, state: 'verified', ...metadata, builtAt: new Date().toISOString(), ...fingerprint, files };
  await writeFile(path.join(directory, 'build-info.json'), `${JSON.stringify(info, null, 2)}\n`);
  return info;
}

/** Root verification checks the listed extension files without hashing the repository around them. */
export async function verifyProvenance(directory, { checkInputs = true, exact = true } = {}) {
  const info = JSON.parse(await readFile(path.join(directory, 'build-info.json'), 'utf8'));
  if (info.schema !== 1 || info.state !== 'verified' || !info.buildId || !info.files || !info.inputs) throw new Error(`Unverified build: ${directory}`);
  if (digest(JSON.stringify(info.inputs)) !== info.sourceHash) throw new Error(`Invalid source fingerprint: ${directory}`);
  const expectedId = buildIdentity(info.sourceHash, { version: info.version, mode: info.mode, output: info.output, lab: info.lab, mv3: info.mv3, cssOnly: info.cssOnly });
  if (expectedId !== info.buildId) throw new Error(`Invalid build identity: ${directory}`);
  for (const [name, hash] of Object.entries(info.files)) {
    const file = path.resolve(directory, name);
    if (!file.startsWith(path.resolve(directory) + path.sep)) throw new Error(`Invalid artifact path: ${name}`);
    if (digest(await readFile(file)) !== hash) throw new Error(`Artifact differs from tested build: ${name}`);
  }
  if (exact) {
    const actual = (await filesIn(directory)).filter((name) => name !== 'build-info.json');
    if (JSON.stringify(actual) !== JSON.stringify(Object.keys(info.files))) throw new Error(`Unexpected or missing build files: ${directory}`);
  }
  if (checkInputs && (await sourceFingerprint()).sourceHash !== info.sourceHash) throw new Error(`Build is stale; source inputs changed: ${directory}`);
  return info;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = path.resolve(root, process.argv[2] || 'dist/firefox');
  const info = await verifyProvenance(target, { exact: target !== root });
  console.log(`Verified ${info.buildId} (${info.mode}, ${Object.keys(info.files).length} files)`);
}
