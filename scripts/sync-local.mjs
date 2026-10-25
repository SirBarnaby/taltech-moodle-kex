// The unpacked extension may have been loaded from the repository root or dist/firefox.
// Build once and update both entry points so a Firefox Reload always sees the same code.
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyProvenance } from './provenance.mjs';
await import('./build.mjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist/firefox');
const info = await verifyProvenance(dist);
for (const name of [...Object.keys(info.files), 'build-info.json']) {
  await mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await cp(path.join(dist, name), path.join(root, name));
}
const installed = await verifyProvenance(root, { exact: false });
if (installed.buildId !== info.buildId) throw new Error('Local extension entry points do not match');
console.log(`Local extension synchronized and verified: ${info.buildId}. Reload the temporary add-on in Firefox.`);
