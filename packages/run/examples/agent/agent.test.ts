import { afterEach, expect, it, vi } from 'vitest';

import { Agent } from './agent';
import { delay, MINUTE, model, tools, type Message, type ToolCall } from './services';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

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

  // next takes a prompt, so an idle await cannot start a run
  await expect(agent.then((reply) => reply)).rejects.toThrow(
    `${agent} is idle. next() takes arguments; call it to start a run.`
  );
  expect(agent.then.runs).toBe(0);
});

it('will join a turn in progress', async () => {
  const agent = Agent.new({ mode: 'yolo' });

  agent.next('write notes');

  // a run is active, so awaiting the instance joins it
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

  // presence is reactive - an effect reading allow reruns as the wait opens and closes
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

  // an answer's Promise settles once that step and what it scheduled are done - not the whole run
  await agent.allow(call);

  expect(agent.messages.get(-1)).toEqual({ role: 'tool', content: 'call_1_0: write notes ok' });
  expect(await reply).toBe('done');
});

it('will answer the tool call it is given', async () => {
  const agent = Agent.new();
  const reply = agent.next('write notes, write docs');

  await vi.waitFor(() => expect(agent.then.waiting).toHaveLength(2));

  const [notes, docs] = agent.then.waiting.map((wait) => wait.args[0] as ToolCall);

  // routed by first argument: the wait opened by tool(docs) takes it
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

  // nothing is buffered - a held reference throws once no wait accepts it
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

  // each queued call settles with its own run
  expect(agent.then.queue).toEqual([['read docs']]);

  await first;
  expect(agent.then.queue).toEqual([]);

  await second;
  expect(agent.messages.get(-1)).toEqual({ role: 'assistant', content: 'done' });
  expect(agent.messages.size).toBe(8);
});

it('will keep what a failing turn committed', async () => {
  const agent = Agent.new({ mode: 'yolo' });
  const { create } = model;

  vi.spyOn(model, 'create')
    .mockImplementationOnce(create)
    .mockImplementationOnce(async (_, { onChunk } = {}) => {
      onChunk?.('Writing');
      throw new Error('overloaded');
    });

  await expect(agent.next('write notes')).rejects.toThrow('overloaded');
  // light journal: committed pushes stay, the failing turn's draft chunks are restored
  expect([...agent.messages].map((message) => message.content)).toEqual(['write notes', '', 'call_1_0: write notes ok']);
  expect(agent.draft.size).toBe(0);
  expect(agent.then.record.map((entry) => [entry.id, entry.wrote, entry.undone])).toEqual([
    ['next#1', ['messages'], undefined],
    ['turn#1', ['messages'], undefined],
    ['tool#1', [], undefined],
    ['exec#1', ['messages'], undefined]
  ]);
});

it('will abort the model call when stopped mid-turn', async () => {
  const agent = Agent.new({ mode: 'yolo' });
  const create = vi.spyOn(model, 'create').mockImplementationOnce(async (_, { signal, onChunk } = {}) => {
    onChunk?.('Writing');
    await delay(MINUTE, { signal: signal! });

    return { role: 'assistant', content: 'late' } as Message;
  });

  const reply = agent.next('write notes');

  await vi.waitFor(() => expect(agent.draft.get()).toEqual(['Writing']));
  agent.then.stop();

  await expect(reply).rejects.toMatchObject({ name: 'Stopped' });
  expect(create.mock.calls[0][1]!.signal!.aborted).toBe(true);
  expect(agent.draft.size).toBe(0);
  expect([...agent.messages].map((message) => message.content)).toEqual(['write notes']);
  expect(agent.then.record.map((entry) => entry.id)).toEqual(['next#1']);
});

it('will retry a tool, keeping what the tool pushed from outside', async () => {
  const agent = Agent.new({ mode: 'yolo' });

  vi.spyOn(tools, 'run').mockImplementationOnce(async (call) => {
    agent.messages.push({ role: 'tool', content: `${call.id}: started` });
    throw new Error('timeout');
  });

  expect(await agent.next('write notes')).toBe('done');
  expect([...agent.messages].map((message) => message.content)).toEqual([
    'write notes',
    '',
    'call_1_0: started',
    'call_1_0: write notes ok',
    'done'
  ]);
  // the failed try is its own entry with its error; the re-run carries attempt 1
  expect(agent.then.record.filter((entry) => entry.key == 'exec').map((entry) => [entry.attempt, (entry.error as Error)?.message])).toEqual([
    [undefined, 'timeout'],
    [1, undefined]
  ]);
});

it('will deny a tool call nobody answers within a minute', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  const agent = Agent.new();
  const reply = agent.next('write notes');

  await vi.advanceTimersByTimeAsync(MINUTE - 1);
  expect(agent.then.status).toBe('waiting');

  await vi.advanceTimersByTimeAsync(1);
  expect(await reply).toBe('done');
  expect(agent.messages.get(-2)).toEqual({ role: 'tool', content: 'call_1_0: denied' });
});

it('will time out each tool call on its own', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  const agent = Agent.new();
  const reply = agent.next('write notes, write docs');

  await vi.advanceTimersByTimeAsync(MINUTE / 2);

  const [notes, docs] = agent.then.waiting.map((wait) => wait.args[0] as ToolCall);

  await agent.allow(docs);
  await vi.advanceTimersByTimeAsync(MINUTE / 2);

  expect(await reply).toBe('done');
  expect(agent.then.record.filter((entry) => entry.wake).map((entry) => [entry.key, entry.args[0], entry.wake])).toEqual([
    ['allow', docs, 'wait#2'],
    ['deny', notes, 'wait#1']
  ]);
});

it('will time out parallel tool calls each against its own wait', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  const agent = Agent.new();
  const reply = agent.next('write notes, write docs');

  await vi.advanceTimersByTimeAsync(MINUTE);

  expect(await reply).toBe('done');
  expect(agent.then.record.filter((entry) => entry.wake).map((entry) => [(entry.args[0] as ToolCall).id, entry.wake])).toEqual([
    ['call_1_0', 'wait#1'],
    ['call_1_1', 'wait#2']
  ]);
});

it('will not let a stale timeout deny the next turn', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

  const agent = Agent.new();
  const first = agent.next('write notes');

  await vi.advanceTimersByTimeAsync(MINUTE / 2);
  await agent.allow(agent.then.waiting[0].args[0] as ToolCall);
  await first;

  const second = agent.next('write docs');

  // the first run's watcher was aborted when its wait closed; this wait gets a fresh minute
  await vi.advanceTimersByTimeAsync(MINUTE / 2);
  expect(agent.then.status).toBe('waiting');

  await vi.advanceTimersByTimeAsync(MINUTE / 2);
  expect(await second).toBe('done');
  expect(agent.messages.get(-2)).toEqual({ role: 'tool', content: 'call_5_0: denied' });
});

it('will pull steering sent mid-turn before ending', async () => {
  const agent = Agent.new({ mode: 'yolo' });
  const reply = agent.next('write notes');

  // the push is unmanaged; the pull happens inside turn, so it is part of that turn's entry
  agent.steers.push('read docs');

  expect(await reply).toBe('done');
  expect(agent.steers.size).toBe(0);
  expect([...agent.messages].map((message) => message.content)).toEqual([
    'write notes',
    '',
    'call_1_0: write notes ok',
    'done',
    'read docs',
    '',
    'call_5_0: read docs ok',
    'done'
  ]);
  expect(agent.then.record.find((entry) => entry.id == 'turn#2')!.wrote).toContain('steers');
});

it('will steer later tool calls by writing mode', async () => {
  const agent = Agent.new();
  const reply = agent.next('write notes');

  await vi.waitFor(() => expect(agent.then.status).toBe('waiting'));

  const [call] = agent.then.waiting.map((wait) => wait.args[0] as ToolCall);

  agent.mode = 'yolo';
  agent.steers.push('write docs');

  await agent.allow(call);

  expect(await reply).toBe('done');
  expect(agent.messages.get(-2)).toEqual({ role: 'tool', content: 'call_5_0: write docs ok' });
  // only the first call waited; a steer is in no entry
  expect(agent.then.record.filter((entry) => entry.wake)).toHaveLength(1);
  expect(agent.then.record.some((entry) => entry.wrote.includes('mode'))).toBe(false);
});

it('will end a turn early from outside', async () => {
  const agent = Agent.new();
  const reply = agent.next('write notes');

  await vi.waitFor(() => expect(agent.allow).toBeDefined());

  // end runs with this value; the open wait is released and nothing is undone
  agent.then.end({ role: 'assistant', content: 'enough' });

  expect(await reply).toBe('enough');
  expect(agent.allow).toBeUndefined();
  expect(agent.then.status).toBe('idle');
  expect(agent.messages.size).toBe(2);
});

it('will stop a turn when destroyed', async () => {
  const agent = Agent.new();
  const reply = agent.next('write notes');

  await vi.waitFor(() => expect(agent.then.status).toBe('waiting'));

  agent.set(null);

  await expect(reply).rejects.toMatchObject({ name: 'Stopped' });
  expect(agent.then.status).toBe('stopped');
});
