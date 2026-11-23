import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, open, truncate, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyBackupFiles, hashDescritor } from '../scripts/check-supabase-backup-files.mjs';

test('empty or missing backup files fail closed', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'backup-offline-test-'));
  try {
    const paths = ['roles.sql', 'schema.sql', 'data.sql'].map(name => join(dir, name));
    await writeFile(paths[0], 'role fixture');
    await writeFile(paths[1], '');
    const result = await verifyBackupFiles(paths);
    assert.equal(result.export_files_present, false);
    assert.equal(result.restorable, false);
    assert.equal(result.errors.length, 2);
    assert.equal(result.results[0].present, true);
    assert.equal(result.results[1].present, false);
    assert.equal(result.results[2].present, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('all readable nonempty files yield hashes, never claim restorable', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'backup-offline-test-'));
  try {
    const paths = ['roles.sql', 'schema.sql', 'data.sql'].map(name => join(dir, name));
    for (let i = 0; i < paths.length; i += 1) await writeFile(paths[i], 'fixture ' + i);
    const result = await verifyBackupFiles(paths);
    assert.equal(result.export_files_present, true);
    assert.equal(result.restorable, false);
    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.results.map(row => row.name), ['roles.sql', 'schema.sql', 'data.sql']);
    for (const row of result.results) {
      assert.equal(row.present, true);
      assert.ok(row.bytes > 0);
      assert.match(row.sha256, /^[a-f0-9]{64}$/);
    }
    assert.doesNotMatch(JSON.stringify(result), /fixture [012]|backup-offline-test-/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('wrong order and wrong shape cannot produce a passing manifest', async () => {
  const invalid = [
    [],
    ['roles.sql', 'data.sql', 'schema.sql'],
    ['roles.sql', 'schema.sql', 'data.sql', 'extra.sql'],
    [null, 'schema.sql', 'data.sql'],
  ];
  for (const paths of invalid) {
    const result = await verifyBackupFiles(paths);
    assert.equal(result.export_files_present, false);
    assert.equal(result.restorable, false);
  }
});

test('concurrent truncation of an open file is detected instead of hashing old size', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'backup-offline-test-'));
  const path = join(dir, 'roles.sql');
  try {
    await writeFile(path, Buffer.alloc(150000, 65));
    const handle = await open(path, 'r');
    try {
      await assert.rejects(
        hashDescritor(handle, async block => {
          if (block === 1) await truncate(path, 0);
        }),
        /Arquivo alterado, truncado ou substituído/,
      );
    } finally {
      await handle.close();
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('symlink masquerading as a dump cannot be approved', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'backup-offline-test-'));
  try {
    const paths = ['roles.sql', 'schema.sql', 'data.sql'].map(name => join(dir, name));
    const target = join(dir, 'target.sql');
    await writeFile(target, 'fixture');
    await writeFile(paths[1], 'schema');
    await writeFile(paths[2], 'data');
    try {
      await symlink(target, paths[0]);
    } catch (error) {
      if (error.code === 'EPERM' || error.code === 'EACCES') {
        t.skip('Sistema operacional não permite symlink nesta conta');
        return;
      }
      throw error;
    }
    const result = await verifyBackupFiles(paths);
    assert.equal(result.export_files_present, false);
    assert.equal(result.results[0].present, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
