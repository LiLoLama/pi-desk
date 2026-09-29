import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('native markdown parser renders structure and file links', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'pi-desk-md-'));
  try {
    const markdown = await readFile(path.join(root, 'native/Markdown.swift'), 'utf8');
    const helpers = markdown
      .replace(/^import AppKit\nimport SwiftUI\n+/, '')
      .replace(/\nstruct ChatMarkdown[\s\S]*$/, '\n');
    const checks = await readFile(path.join(root, 'test/markdown-checks.swift'), 'utf8');
    const file = path.join(tmp, 'markdown-test.swift');
    await writeFile(file, `import Foundation\n${helpers}\n${checks}\n`);
    const compiled = path.join(tmp, 'markdown-test');
    const build = spawnSync(
      'swiftc',
      ['-swift-version', '5', file, '-o', compiled, '-module-cache-path', '/private/tmp/pi-desk-swift-cache'],
      {encoding: 'utf8'},
    );
    assert.equal(build.status, 0, build.stderr || build.stdout);
    const run = spawnSync(compiled, {encoding: 'utf8'});
    assert.equal(run.status, 0, run.stderr || run.stdout);
    assert.match(run.stdout, /ok/);
  } finally {
    await rm(tmp, {recursive: true, force: true});
  }
});
