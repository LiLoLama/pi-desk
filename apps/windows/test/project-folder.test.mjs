import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rename,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Rückmeldung aus einem Windows-Test: Nach dem Verschieben des Projektordners zeigte Pi Desk nur „OMP beendet (1)“.
test('a moved project folder is reported by name instead of "OMP beendet"', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'pi-desk-folder-'));
  const project = path.join(tmp, 'projekt');
  await mkdir(project);
  const server = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: {...process.env, PI_DESK_PORT: '0', PI_DESK_DATA: path.join(tmp, 'data')},
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const origin = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Server startup timed out')), 15000);
      server.stdout.once('data', chunk => { clearTimeout(timer); resolve(String(chunk).trim().replace('Pi Desk ', '')); });
      server.once('exit', code => { clearTimeout(timer); reject(Error('Server exit ' + code)); });
    });
    const cookie = (await fetch(origin)).headers.get('set-cookie').split(';')[0];
    const api = async (route, body) => {
      const response = await fetch(origin + '/api/' + route, {
        method: body ? 'POST' : 'GET',
        headers: {cookie, ...(body ? {'Content-Type': 'application/json', 'X-Pi-Desk': '1', Origin: origin} : {})},
        body: body ? JSON.stringify(body) : undefined,
      });
      return {ok: response.ok, json: await response.json()};
    };
    const {json: p} = await api('projects', {path: project});
    const {json: t} = await api('tasks', {projectId: p.id});
    await rename(project, path.join(tmp, 'projekt-verschoben'));
    const session = await api('session?taskId=' + t.id);
    assert.equal(session.ok, false);
    assert.match(session.json.error, /Projektordner nicht gefunden/);
    assert.ok(session.json.error.includes(p.path), session.json.error);
  } finally {
    await new Promise(resolve => { if (server.exitCode !== null) return resolve(); server.once('exit', resolve); server.kill('SIGTERM'); });
    await rm(tmp, {recursive: true, force: true});
  }
});
