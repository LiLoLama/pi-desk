import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('native update rules: versions, notes and replaceable locations', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'pi-desk-updates-'));
  try {
    const logic = (await readFile(path.join(root, 'native/UpdateLogic.swift'), 'utf8')).replace(/^import Foundation\n+/, '');
    const checks = await readFile(path.join(root, 'test/update-logic-checks.swift'), 'utf8');
    const file = path.join(tmp, 'update-logic.swift');
    await writeFile(file, `import Foundation\n${logic}\n${checks}\n`);
    const binary = path.join(tmp, 'update-logic');
    const build = spawnSync('swiftc', ['-swift-version', '5', file, '-o', binary, '-module-cache-path', '/private/tmp/pi-desk-swift-cache'], {encoding: 'utf8'});
    assert.equal(build.status, 0, build.stderr || build.stdout);
    const run = spawnSync(binary, {encoding: 'utf8'});
    assert.equal(run.status, 0, run.stderr || run.stdout);
    assert.match(run.stdout, /ok/);
  } finally {
    await rm(tmp, {recursive: true, force: true});
  }
});
