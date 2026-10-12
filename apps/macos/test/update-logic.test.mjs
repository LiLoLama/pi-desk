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

test('the app bundle compiles WhatsNew.swift and ships CHANGELOG.md', async () => {
  const build = await readFile(path.join(root, 'native/build.py'), 'utf8');
  assert.match(build, /'WhatsNew\.swift'/);
  assert.match(build, /shutil\.copy2\(root\/'CHANGELOG\.md',resources\/'CHANGELOG\.md'\)/);
});

// Window behavior cannot run headless here; these guard the two review findings at source level.
test('whats new window closes with Esc via the cancel shortcut', async () => {
  const source = await readFile(path.join(root, 'native/WhatsNew.swift'), 'utf8');
  assert.match(source, /\.keyboardShortcut\(\.cancelAction\)/);
});
test('a held update dialog brings the hidden whats new window to the front', async () => {
  const source = await readFile(path.join(root, 'native/Updates.swift'), 'utf8');
  const held = source.slice(source.indexOf('if WhatsNew.shared.isOpen {'), source.indexOf('      return\n    }', source.indexOf('if WhatsNew.shared.isOpen {')));
  assert.match(held, /WhatsNew\.shared\.bringToFront\(\)/);
});
