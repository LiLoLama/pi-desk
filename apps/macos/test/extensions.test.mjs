import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Plugins,pluginInfo} from '../plugins.mjs';
import {listWorktrees,addWorktree,removeWorktree} from '../worktrees.mjs';
import {listRules,saveRule} from '../rules.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);

test('local plugins and hooks persist, activate, and keep originals', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pi-plug-'));
  try {
    const source = path.join(root, 'plug');
    await mkdir(source);
    await writeFile(path.join(source, 'package.json'), JSON.stringify({name: 'desk-plug', version: '0.0.1'}));
    const hook = path.join(root, 'hook.js');
    await writeFile(hook, 'export default {};\n');
    const p = new Plugins(root, fileURLToPath(new URL('../runtime/omp', import.meta.url)));
    await p.init();
    const [plugin] = await p.addPlugin(source);
    assert.equal(plugin.enabled, false);
    assert.equal((await p.enabledDirs()).length, 0);
    await p.setPlugin(plugin.id, true);
    assert.deepEqual(await p.enabledDirs(), [await pluginInfo(source).then(x => x.path)]);
    const [h] = await p.addHook(hook);
    await p.setHook(h.id, true);
    assert.equal((await p.enabledHooks()).length, 1);
    await p.setPlugin(plugin.id, false, true);
    await p.setHook(h.id, false, true);
    assert.equal((await p.plugins()).length, 0);
    assert.match(await (await import('node:fs/promises')).readFile(path.join(source, 'package.json'), 'utf8'), /desk-plug/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('worktrees add and remove extra checkouts without touching the main tree', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pi-wt-'));
  try {
    const repo = path.join(root, 'repo');
    await mkdir(repo);
    await exec('git', ['init'], {cwd: repo});
    await exec('git', ['-C', repo, 'config', 'user.email', 'a@b.c']);
    await exec('git', ['-C', repo, 'config', 'user.name', 't']);
    await writeFile(path.join(repo, 'f.txt'), 'keep');
    await exec('git', ['-C', repo, 'add', '.']);
    await exec('git', ['-C', repo, 'commit', '-m', 'i']);
    const dest = path.join(root, 'feature');
    const added = await addWorktree(repo, {path: dest, branch: 'feature'});
    assert.ok(added.worktrees.some(w => w.path === dest || w.path.endsWith('/feature')));
    assert.equal(await (await import('node:fs/promises')).readFile(path.join(repo, 'f.txt'), 'utf8'), 'keep');
    await removeWorktree(repo, dest);
    const after = await listWorktrees(repo);
    assert.equal(after.worktrees.length, 1);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('project rule files save, persist and delete when emptied', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pi-rules-'));
  try {
    let files = await saveRule(root, 'AGENTS.md', 'Antworte auf Deutsch.');
    assert.equal(files.find(f => f.name === 'AGENTS.md').text, 'Antworte auf Deutsch.');
    files = await listRules(root);
    assert.equal(files.find(f => f.name === 'AGENTS.md').exists, true);
    files = await saveRule(root, 'AGENTS.md', '  ');
    assert.equal(files.find(f => f.name === 'AGENTS.md').exists, false);
    await assert.rejects(saveRule(root, 'secret.md', 'x'), /Unbekannte/);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
