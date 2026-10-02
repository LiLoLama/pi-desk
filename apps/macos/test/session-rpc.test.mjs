import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Rpc} from '../rpc.mjs';

test('OMP session RPCs accept thinking, stats, todos, commands, compact and subagents', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'pi-desk-session-rpc-'));
  const agent = path.join(root, 'agent');
  const project = path.join(root, 'project');
  await mkdir(agent);
  await mkdir(project);
  await writeFile(path.join(project, 'note.txt'), 'hello');
  await writeFile(
    path.join(agent, 'models.yml'),
    `providers:
  desk-test:
    baseUrl: http://127.0.0.1:9/v1
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
    '--tools=read,todo,task', '--no-extensions', '--no-skills', '--no-rules', '--no-lsp', '--no-title',
    '--approval-mode=yolo', `--session-dir=${path.join(root, 'sessions')}`,
  ];
  const env = { ...process.env, PI_CODING_AGENT_DIR: agent };
  let rpc;
  try {
    rpc = await new Rpc(binary, args, env).start();
    await rpc.request('set_thinking_level', { level: 'low' });
    await rpc.request('set_fast_mode', { enabled: false });
    await rpc.request('set_auto_compaction', { enabled: true });
    await rpc.request('set_auto_retry', { enabled: true });
    await rpc.request('set_steering_mode', { mode: 'all' });
    await rpc.request('set_follow_up_mode', { mode: 'one-at-a-time' });
    await rpc.request('set_interrupt_mode', { mode: 'immediate' });
    await rpc.request('set_subagent_subscription', { level: 'events' });
    const todos = await rpc.request('set_todos', {
      phases: [{ name: 'Plan', tasks: [{ content: 'Lesen', status: 'pending' }] }],
    });
    assert.ok(Array.isArray(todos.todoPhases));
    const state = await rpc.request('get_state');
    assert.ok(state.sessionFile);
    assert.equal(typeof state.isSettled, 'boolean');
    assert.equal(typeof state.hasPendingAsyncWork, 'boolean');
    assert.ok(Array.isArray(state.queuedMessages?.steering));
    assert.ok(Array.isArray(state.queuedMessages?.followUp));
    const thinking = await rpc.request('get_available_thinking_levels');
    assert.ok(Array.isArray(thinking.levels));
    const stats = await rpc.request('get_session_stats');
    assert.equal(typeof stats, 'object');
    const commands = await rpc.request('get_available_commands');
    assert.ok(Array.isArray(commands.commands));
    const agents = await rpc.request('get_subagents');
    assert.ok(Array.isArray(agents.subagents));
    await rpc.request('get_branch_messages');
    await rpc.request('get_last_assistant_text');
    await rpc.request('set_session_name', { name: 'RPC-Prüfung' });
    console.log('PASS: session control RPCs accepted without a live model call');
  } finally {
    await rpc?.close();
    await rm(root, { recursive: true, force: true });
  }
});
