import { expect, it, vi } from 'vitest';

import { schedule, transition, unschedule } from './scheduler';
import type { Schedulable } from './scheduler';

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
  const scope = target();
  transition(() => schedule(scope));
  unschedule(scope);

  expect(() => transition(() => {
    throw new Error('stop');
  })).toThrow('stop');

  schedule(scope);
  await Promise.resolve();
  expect(scope.update).toHaveBeenCalledWith(false);
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
