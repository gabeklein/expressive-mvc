import { expect, it, vi } from 'vitest';

import { Agent } from './agent';
import type { ToolCall } from './services';

it('will run a turn to end', async () => {
  const agent = Agent.new({ mode: 'yolo' });

  expect(await agent.next('write notes')).toBe('done');
  expect([...agent.messages].map((message) => message.content)).toEqual([
    'write notes',
    '',
    'call_1_0: write notes ok',
    'done'
  ]);
  expect(agent.then.record.map((entry) => entry.id)).toEqual(['next#1', 'turn#1', 'tool#1', 'exec#1', 'turn#2', 'end#1']);
});

it('will not be awaitable without a prompt', async () => {
  const agent = Agent.new({ mode: 'yolo' });
  // @ts-expect-error
  const start = () => agent.then((reply) => reply);

  void start;
  expect(await agent.next('write notes')).toBe('done');
});

it('will run safe tools without asking in auto', async () => {
  const agent = Agent.new({ mode: 'auto' });

  expect(await agent.next('read notes')).toBe('done');
  expect(agent.then.waiting).toEqual([]);
});

it('will wait for approval and resume', async () => {
  const agent = Agent.new();
  const reply = agent.next('write notes, read docs');

  await vi.waitFor(() => expect(agent.then.status).toBe('waiting'));

  const [write, read] = agent.then.waiting.map((wait) => wait.context as ToolCall);

  expect(write).toMatchObject({ name: 'write', input: 'notes' });
  expect(read).toMatchObject({ name: 'read', input: 'docs' });

  agent.allow(write);
  agent.deny(read);

  expect(await reply).toBe('done');
  expect([...agent.messages].map((message) => message.content)).toContain('call_1_1: denied');
  expect(agent.then.record.filter((entry) => entry.wake).map((entry) => [entry.key, entry.wake])).toEqual([
    ['allow', 'wait#1'],
    ['deny', 'wait#2']
  ]);
});

it('will keep messages across runs', async () => {
  const agent = Agent.new({ mode: 'yolo' });

  await agent.next('write notes');
  await agent.next('write tests');

  expect(agent.messages.size).toBe(8);
  expect(agent.then.runs).toBe(2);
  expect(agent.then.record[0].args).toEqual(['write tests']);
});

it('will queue a prompt sent mid-turn', async () => {
  const agent = Agent.new({ mode: 'yolo' });
  const first = agent.next('write notes');
  const second = agent.next('read docs');

  expect(agent.then.queue).toEqual([['read docs']]);

  await first;
  expect(agent.then.queue).toEqual([]);

  await second;
  expect(agent.messages.get(-1)).toEqual({ role: 'assistant', content: 'done' });
  expect(agent.messages.size).toBe(8);
});
