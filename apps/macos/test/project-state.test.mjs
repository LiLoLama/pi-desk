import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,rename,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Rückmeldung von Ulrike: Projekte ließen sich weder umbenennen noch aus der Liste entfernen.
async function withServer(run) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'pi-desk-projects-'));
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
      const json = await response.json();
      if (!response.ok) throw Error(json.error);
      return json;
    };
    const folder = async name => { const dir = path.join(tmp, name); await mkdir(dir); return dir; };
    await run({api, folder, tmp});
  } finally {
    await new Promise(resolve => { if (server.exitCode !== null) return resolve(); server.once('exit', resolve); server.kill('SIGTERM'); });
    await rm(tmp, {recursive: true, force: true});
  }
}

test('a project can be renamed without touching its folder', () => withServer(async ({api, folder}) => {
  const dir = await folder('experiment-3');
  const p = await api('projects', {path: dir});
  const renamed = await api('project-state', {projectId: p.id, action: 'rename', name: '  Kundenangebot  '});
  assert.equal(renamed.name, 'Kundenangebot');
  assert.equal(renamed.path, p.path);
  assert.ok((await stat(dir)).isDirectory());
  await assert.rejects(api('project-state', {projectId: p.id, action: 'rename', name: '   '}), /Name fehlt/);
  const reset = await api('project-state', {projectId: p.id, action: 'reset-name'});
  assert.equal(reset.name, 'experiment-3');
}));

test('removing a project moves its chats to the trash and keeps the folder', () => withServer(async ({api, folder}) => {
  const dir = await folder('spielwiese');
  const p = await api('projects', {path: dir});
  const a = await api('tasks', {projectId: p.id});
  const b = await api('tasks', {projectId: p.id});
  await api('task-state', {taskId: b.id, action: 'archive'});
  await api('project-state', {projectId: p.id, action: 'remove'});
  let state = await api('state');
  assert.ok(state.projects.find(x => x.id === p.id).removedAt);
  assert.ok(state.tasks.every(t => t.deletedAt && !t.archivedAt), 'auch archivierte Chats landen im Papierkorb');
  assert.ok((await stat(dir)).isDirectory(), 'der Ordner bleibt erhalten');
  await assert.rejects(api('tasks', {projectId: p.id}), /Projekt wurde entfernt/);
  await assert.rejects(api('project-state', {projectId: p.id, action: 'rename', name: 'x'}), /Projekt wurde entfernt/);

  // Ein Chat aus dem Papierkorb holt sein Projekt zurück.
  await api('task-state', {taskId: a.id, action: 'restore'});
  state = await api('state');
  assert.equal(state.projects.find(x => x.id === p.id).removedAt, undefined);

  // Erneutes Öffnen des Ordners nimmt dasselbe Projekt wieder auf, statt ein zweites anzulegen.
  await api('project-state', {projectId: p.id, action: 'remove'});
  const reopened = await api('projects', {path: dir});
  assert.equal(reopened.id, p.id);
  assert.equal(reopened.removedAt, undefined);
  assert.equal((await api('state')).projects.length, 1);
}));

test('emptying the trash forgets removed projects without chats', () => withServer(async ({api, folder}) => {
  const keep = await api('projects', {path: await folder('bleibt')});
  const gone = await api('projects', {path: await folder('weg')});
  await api('tasks', {projectId: gone.id});
  await api('project-state', {projectId: gone.id, action: 'remove'});
  await api('task-state', {action: 'empty'});
  const state = await api('state');
  assert.deepEqual(state.projects.map(p => p.id), [keep.id]);
  assert.equal(state.tasks.length, 0);
  // Ein Projekt ohne Chats verschwindet sofort.
  await api('project-state', {projectId: keep.id, action: 'remove'});
  assert.deepEqual((await api('state')).projects, []);
}));

test('a moved folder can be relinked and keeps its chats', () => withServer(async ({api, folder, tmp}) => {
  const dir = await folder('alt');
  const p = await api('projects', {path: dir});
  const t = await api('tasks', {projectId: p.id});
  const moved = path.join(tmp, 'neu');
  await rename(dir, moved);
  const relinked = await api('project-state', {projectId: p.id, action: 'relink', path: moved});
  assert.equal(relinked.id, p.id);
  assert.equal(relinked.name, 'neu', 'der unveränderte Ordnername folgt dem neuen Ordner');
  assert.ok(relinked.path.endsWith(path.sep + 'neu'));
  assert.equal((await api('state')).tasks.find(x => x.id === t.id).projectId, p.id);

  // Ein selbst vergebener Name bleibt beim Neu-Zuordnen erhalten.
  await api('project-state', {projectId: p.id, action: 'rename', name: 'Mein Projekt'});
  const other = await folder('anderswo');
  assert.equal((await api('project-state', {projectId: p.id, action: 'relink', path: other})).name, 'Mein Projekt');

  // Ein Ordner, der schon als anderes Projekt offen ist, wird nicht doppelt vergeben.
  const busy = await folder('belegt');
  await api('projects', {path: busy});
  await assert.rejects(api('project-state', {projectId: p.id, action: 'relink', path: busy}), /bereits als Projekt/);
}));

test('relinking onto a removed project merges its trashed chats', () => withServer(async ({api, folder}) => {
  const target = await folder('ziel');
  const old = await api('projects', {path: target});
  const oldChat = await api('tasks', {projectId: old.id});
  await api('project-state', {projectId: old.id, action: 'remove'});
  const p = await api('projects', {path: await folder('quelle')});
  await api('project-state', {projectId: p.id, action: 'relink', path: target});
  const state = await api('state');
  assert.deepEqual(state.projects.map(x => x.id), [p.id]);
  assert.equal(state.tasks.find(x => x.id === oldChat.id).projectId, p.id);
}));
