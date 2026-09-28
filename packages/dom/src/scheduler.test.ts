import { expect, it, vi } from 'vitest';

import { schedule, transition, unschedule } from './scheduler';
import type { Schedulable } from './scheduler';
import { mockError } from '../test.setup';

const error = mockError();

function target(update = vi.fn()): Schedulable {
  return { update };
}

it('will batch urgent work in a microtask', async () => {
  const scope = target();

  schedule(scope);
  schedule(scope);
  expect(scope.update).not.toHaveBeenCalled();

  await Promise.resolve();
  expect(scope.update).toHaveBeenCalledOnce();
  expect(scope.update).toHaveBeenCalledWith(false);
  expect(scope.queued).toBeUndefined();
});

it('will defer transition work to a task', async () => {
  vi.useFakeTimers();
  const scope = target();
  const second = target();

  transition(() => {
    schedule(scope);
    schedule(scope);
    schedule(second);
  });

  await Promise.resolve();
  expect(scope.update).not.toHaveBeenCalled();

  await vi.runAllTimersAsync();
  expect(scope.update).toHaveBeenCalledWith(true);
  expect(second.update).toHaveBeenCalledWith(true);
  vi.useRealTimers();
});

it('will promote passive work when an urgent update arrives', async () => {
  vi.useFakeTimers();
  const scope = target();

  transition(() => schedule(scope));
  schedule(scope);
  await Promise.resolve();

  expect(scope.update).toHaveBeenCalledWith(false);
  await vi.runAllTimersAsync();
  expect(scope.update).toHaveBeenCalledOnce();
  vi.useRealTimers();
});

it('will ignore stale passive queue entries', async () => {
  vi.useFakeTimers();
  const scope = target();

  transition(() => schedule(scope));
  scope.queued = 'urgent';
  await vi.runAllTimersAsync();

  expect(scope.update).not.toHaveBeenCalled();
  vi.useRealTimers();
});

it('will unschedule work and restore priority after an error', async () => {
  vi.useFakeTimers();
  const scope = target();
  transition(() => schedule(scope));
  unschedule(scope);

  expect(() => transition(() => {
    throw new Error('stop');
  })).toThrow('stop');

  schedule(scope);
  await Promise.resolve();
  expect(scope.update).toHaveBeenCalledWith(false);
  await vi.runAllTimersAsync();
  vi.useRealTimers();
});

it('will settle failed work and continue the queue', async () => {
  vi.useFakeTimers();
  const expected = new Error('failed');
  const held = vi.fn();
  const failed = target(vi.fn(() => {
    throw expected;
  }));
  const after = target();

  transition(() => {
    schedule(failed);
    schedule(after);
  });
  failed.holds = [held];

  await vi.runAllTimersAsync();
  expect(error).toHaveBeenCalledWith(expected);
  expect(held).toHaveBeenCalledOnce();
  expect(after.update).toHaveBeenCalledWith(true);
  vi.useRealTimers();
});

it('will release holds once the scope updates', async () => {
  vi.useFakeTimers();
  const scope = target();
  const held = vi.fn();

  transition(() => schedule(scope));
  scope.holds = [held];

  await vi.runAllTimersAsync();
  expect(scope.update).toHaveBeenCalledWith(true);
  expect(held).toHaveBeenCalledOnce();
  expect(scope.holds).toBeUndefined();
  vi.useRealTimers();
});

it('will release holds when promoted to urgent', async () => {
  const scope = target();
  const held = vi.fn();

  schedule(scope);
  scope.holds = [held];

  await Promise.resolve();
  expect(held).toHaveBeenCalledOnce();
});

it('will release holds on unschedule', () => {
  const scope = target();
  const held = vi.fn();

  schedule(scope);
  scope.holds = [held];
  unschedule(scope);

  expect(held).toHaveBeenCalledOnce();
});

it('will report an urgent update error and continue', async () => {
  const expected = new Error('failed');
  const failed = target(vi.fn(() => {
    throw expected;
  }));
  const after = target();

  schedule(failed);
  schedule(after);

  await Promise.resolve();
  expect(error).toHaveBeenCalledWith(expected);
  expect(after.update).toHaveBeenCalledWith(false);
});

it('will hold a transition batch while any scope probes as suspended', async () => {
  vi.useFakeTimers();
  let resolve!: () => void;
  const waiting = new Promise<void>((done) => (resolve = done));
  const ready = { ...target(), probe: vi.fn() };
  const blocked = { ...target(), probe: vi.fn((): Promise<void> | undefined => waiting) };

  transition(() => {
    schedule(ready);
    schedule(blocked);
  });

  await vi.runAllTimersAsync();
  expect(ready.update).not.toHaveBeenCalled();
  expect(blocked.update).not.toHaveBeenCalled();
  expect(ready.queued).toBe('deferred');

  blocked.probe.mockReturnValue(undefined);
  resolve();
  await vi.runAllTimersAsync();
  expect(ready.update).toHaveBeenCalledWith(true);
  expect(blocked.update).toHaveBeenCalledWith(true);
  vi.useRealTimers();
});

it('will run empty scopes first and defer the batch when one suspends', async () => {
  vi.useFakeTimers();
  let resolve!: () => void;
  const waiting = new Promise<void>((done) => (resolve = done));
  const order: string[] = [];
  const leaving = { ...target(vi.fn(() => void order.push('leaving'))), empty: () => false };
  const arriving = {
    ...target(vi.fn(() => {
      order.push('arriving');
      return order.length > 1 ? undefined : waiting;
    })),
    empty: () => true
  };

  transition(() => {
    schedule(leaving);
    schedule(arriving);
  });

  await vi.runAllTimersAsync();
  expect(order).toEqual(['arriving']);

  resolve();
  await vi.runAllTimersAsync();
  expect(order).toEqual(['arriving', 'leaving']);
  vi.useRealTimers();
});

it('will let urgent work overtake a deferred scope', async () => {
  vi.useFakeTimers();
  let resolve!: () => void;
  const waiting = new Promise<void>((done) => (resolve = done));
  const deferred = target();
  const blocked = { ...target(), probe: vi.fn((): Promise<void> | undefined => waiting) };

  transition(() => {
    schedule(deferred);
    schedule(blocked);
  });
  await vi.runAllTimersAsync();

  schedule(deferred);
  transition(() => schedule(deferred));
  await Promise.resolve();
  expect(deferred.update).toHaveBeenCalledOnce();
  expect(deferred.update).toHaveBeenCalledWith(false);

  blocked.probe.mockReturnValue(undefined);
  resolve();
  await vi.runAllTimersAsync();
  expect(deferred.update).toHaveBeenCalledOnce();
  vi.useRealTimers();
});

it('will drop a deferred scope unscheduled before resume', async () => {
  vi.useFakeTimers();
  let resolve!: () => void;
  const waiting = new Promise<void>((done) => (resolve = done));
  const deferred = target();
  const blocked = { ...target(), probe: vi.fn((): Promise<void> | undefined => waiting) };

  transition(() => {
    schedule(deferred);
    schedule(blocked);
  });
  await vi.runAllTimersAsync();

  unschedule(deferred);
  blocked.probe.mockReturnValue(undefined);
  resolve();
  await vi.runAllTimersAsync();
  expect(deferred.update).not.toHaveBeenCalled();
  expect(blocked.update).toHaveBeenCalledOnce();
  vi.useRealTimers();
});

it('will skip a batched scope claimed by an earlier update', async () => {
  vi.useFakeTimers();
  const child = target();
  const parent = target(vi.fn(() => {
    child.queued = undefined;
  }));

  transition(() => {
    schedule(parent);
    schedule(child);
  });

  await vi.runAllTimersAsync();
  expect(parent.update).toHaveBeenCalledOnce();
  expect(child.update).not.toHaveBeenCalled();
  vi.useRealTimers();
});
