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

it('will reject an idle await without a prompt', async () => {
  const agent = Agent.new({ mode: 'yolo' });

  await expect(agent.then((reply) => reply)).rejects.toThrow(
    `${agent} is idle. next() takes arguments; call it to start a run.`
  );
  expect(agent.then.runs).toBe(0);
});

it('will join a turn in progress', async () => {
  const agent = Agent.new({ mode: 'yolo' });

  agent.next('write notes');

  expect(await agent).toBe('done');
});

it('will run safe tools without asking in auto', async () => {
  const agent = Agent.new({ mode: 'auto' });

  expect(await agent.next('read notes')).toBe('done');
  expect(agent.then.waiting).toEqual([]);
});

it('will offer allow only while a tool call waits', async () => {
  const agent = Agent.new();
  const seen: boolean[] = [];

  agent.get((self) => void seen.push(!!self.allow));

  expect(agent.allow).toBeUndefined();

  const reply = agent.next('write notes');

  await vi.waitFor(() => expect(agent.allow).toBeDefined());

  const [call] = agent.then.waiting.map((wait) => wait.args[0] as ToolCall);

  await agent.allow(call);

  expect(agent.allow).toBeUndefined();
  expect(await reply).toBe('done');
  expect(seen).toEqual([false, true, false]);
});

it('will resolve allow once its tool has run', async () => {
  const agent = Agent.new();
  const reply = agent.next('write notes');

  await vi.waitFor(() => expect(agent.then.status).toBe('waiting'));

  const [call] = agent.then.waiting.map((wait) => wait.args[0] as ToolCall);

  await agent.allow(call);

  expect(agent.messages.get(-1)).toEqual({ role: 'tool', content: 'call_1_0: write notes ok' });
  expect(await reply).toBe('done');
});

it('will answer the tool call it is given', async () => {
  const agent = Agent.new();
  const reply = agent.next('write notes, write docs');

  await vi.waitFor(() => expect(agent.then.waiting).toHaveLength(2));

  const [notes, docs] = agent.then.waiting.map((wait) => wait.args[0] as ToolCall);

  await agent.allow(docs);

  expect(agent.then.waiting.map((wait) => wait.args[0])).toEqual([notes]);
  expect(agent.messages.get(-1)).toEqual({ role: 'tool', content: 'call_1_1: write docs ok' });

  await agent.deny(notes);

  expect(await reply).toBe('done');
  expect(agent.then.record.filter((entry) => entry.wake).map((entry) => [entry.key, entry.wake])).toEqual([
    ['allow', 'wait#2'],
    ['deny', 'wait#1']
  ]);
});

it('will deny a tool call', async () => {
  const agent = Agent.new();
  const reply = agent.next('write notes');

  await vi.waitFor(() => expect(agent.then.status).toBe('waiting'));

  const [call] = agent.then.waiting.map((wait) => wait.args[0] as ToolCall);

  await agent.deny(call);

  expect(await reply).toBe('done');
  expect([...agent.messages].map((message) => message.content)).toContain('call_1_0: denied');
});

it('will throw if allow is called after its wait closed', async () => {
  const agent = Agent.new();
  const reply = agent.next('write notes');

  await vi.waitFor(() => expect(agent.then.status).toBe('waiting'));

  const { allow } = agent;
  const [call] = agent.then.waiting.map((wait) => wait.args[0] as ToolCall);

  allow(call);

  expect(() => allow(call)).toThrow('allow cannot be called from outside; call next() to run.');
  expect(await reply).toBe('done');
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
