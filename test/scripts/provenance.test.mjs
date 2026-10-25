import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildIdentity, sourceFingerprint, verifyProvenance, writeProvenance } from '../../scripts/provenance.mjs';

test('provenance rejects changed, extra, stale and unverified artifacts', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'kex-provenance-'));
  try {
    const fingerprint = await sourceFingerprint();
    const options = { version: 'test', mode: 'production', output: 'test', lab: false, mv3: false, cssOnly: false };
    const metadata = { ...options, buildId: buildIdentity(fingerprint.sourceHash, options) };
    await writeFile(path.join(directory, 'content.js'), 'tested code');
    const info = await writeProvenance(directory, metadata, fingerprint);
    assert.equal((await verifyProvenance(directory)).buildId, metadata.buildId);
    await writeFile(path.join(directory, 'content.js'), 'old code');
    await assert.rejects(verifyProvenance(directory), /Artifact differs/);
    await writeFile(path.join(directory, 'content.js'), 'tested code');
    await writeFile(path.join(directory, 'extra.js'), 'unlisted');
    await assert.rejects(verifyProvenance(directory), /Unexpected or missing/);
    await rm(path.join(directory, 'extra.js'));
    // A valid artifact from different source must still fail the current-source check.
    const old = { ...fingerprint, inputs: { 'old.ts': 'old-hash' } };
    const { createHash } = await import('node:crypto');
    old.sourceHash = createHash('sha256').update(JSON.stringify(old.inputs)).digest('hex');
    await writeProvenance(directory, { ...metadata, buildId: buildIdentity(old.sourceHash, options) }, old);
    await assert.rejects(verifyProvenance(directory), /Build is stale/);
    await writeFile(path.join(directory, 'build-info.json'), JSON.stringify({ ...info, state: 'watch-unverified' }));
    await assert.rejects(verifyProvenance(directory), /Unverified build/);
  } finally {
    // mkdtemp returns a fresh directory under the OS temp root owned by this test.
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('kex-provenance-'));
    await rm(directory, { recursive: true, force: true });
  }
});
