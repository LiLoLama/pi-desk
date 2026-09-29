import http from 'node:http';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {Rpc} from '../rpc.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'pi-desk-queue-'));
const agent = path.join(root, 'agent');
const project = path.join(root, 'project');
await mkdir(agent);
await mkdir(project);
const held = [];
const provider = http.createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  held.push({req, res, body});
  res.writeHead(200, {'Content-Type': 'text/event-stream'});
});
await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve));
await writeFile(
  path.join(agent, 'models.yml'),
  `providers:
  desk-test:
    baseUrl: http://127.0.0.1:${provider.address().port}/v1
    apiKey: local-fixture-not-a-secret
    api: openai-completions
    models:
      - id: fixture
        name: Local Fixture
        reasoning: false
        input: [text]
        contextWindow: 32000
        maxTokens: 2000
`,
);
const binary = fileURLToPath(new URL('../runtime/omp', import.meta.url));
const args = [
  '--mode', 'rpc-ui', `--cwd=${project}`, '--model=desk-test/fixture', '--thinking=off',
  '--tools=read', '--no-extensions', '--no-skills', '--no-rules', '--no-lsp', '--no-title',
  '--approval-mode=yolo', `--session-dir=${path.join(root, 'sessions')}`,
];
const env = {...process.env, PI_CODING_AGENT_DIR: agent};
const waitFrame = (rpc, predicate) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    rpc.off('frame', listen);
    reject(Error('Expected RPC event not received'));
  }, 20000);
  function listen(f) {
    if (predicate(f)) {
      clearTimeout(timer);
      rpc.off('frame', listen);
      resolve(f);
    }
  }
  rpc.on('frame', listen);
});

let rpc;
let host;
try {
  rpc = await new Rpc(binary, args, env).start();
  const started = waitFrame(rpc, (f) => f.type === 'agent_start');
  rpc.request('prompt', {message: 'Stay busy while I queue more work.'}).catch(() => {});
  await started;
  await rpc.request('follow_up', {message: 'Afterwards, confirm you saw this follow-up.'});
  await rpc.request('steer', {message: 'Interrupt: wait for me.'});
  const state = await rpc.request('get_state');
  assert.equal(state.isStreaming, true);
  assert.ok(state.queuedMessageCount >= 1, 'queuedMessageCount=' + state.queuedMessageCount);
  await rpc.request('abort');
  await rpc.close();
  rpc = undefined;
  console.log('PASS: OMP follow_up and steer while streaming; abort accepted');

  host = spawn(process.execPath, [fileURLToPath(new URL('../server.mjs', import.meta.url))], {
    env: {
      ...process.env,
      PI_DESK_PORT: '0',
      PI_DESK_DATA: path.join(root, 'host-data'),
      PI_DESK_NATIVE_TOKEN: 'queue-token',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('host timeout')), 15000);
    host.stdout.once('data', (chunk) => {
      clearTimeout(timer);
      resolve(String(chunk).trim().replace('Pi Desk ', ''));
    });
    host.once('error', reject);
  });
  const headers = {
    'X-Pi-Desk-Native': 'queue-token',
    'Content-Type': 'application/json',
    'X-Pi-Desk': '1',
    Origin: endpoint,
  };
  const projectRes = await fetch(endpoint + '/api/projects', {
    method: 'POST',
    headers,
    body: JSON.stringify({path: project}),
  });
  const opened = await projectRes.json();
  assert.equal(projectRes.status, 200, JSON.stringify(opened));
  const taskRes = await fetch(endpoint + '/api/tasks', {
    method: 'POST',
    headers,
    body: JSON.stringify({projectId: opened.id}),
  });
  const task = await taskRes.json();
  const follow = await fetch(endpoint + '/api/follow-up', {
    method: 'POST',
    headers,
    body: JSON.stringify({taskId: task.id, message: 'later', context: []}),
  });
  const followBody = await follow.json();
  assert.equal(follow.status, 400);
  assert.match(followBody.error, /arbeitet gerade nicht/);
  const getFollow = await fetch(endpoint + '/api/follow-up', {headers: {'X-Pi-Desk-Native': 'queue-token'}});
  assert.equal(getFollow.status, 405);
  console.log('PASS: host rejects follow-up while idle; POST-only route');
  host.stdin.end();
  await new Promise((resolve) => host.once('exit', resolve));
} finally {
  await rpc?.close();
  if (host?.exitCode === null) host.kill();
  provider.close();
  await rm(root, {recursive: true, force: true});
}
