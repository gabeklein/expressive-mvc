import { describe, expect, it, vi } from 'vitest';

import { mockPromise } from '../../test.setup';
import { Action } from './action';

describe('ready', () => {
  it('will not be ready without a handler', () => {
    expect(Action.new().ready).toBe(false);
  });

  it('will be ready with a handler', () => {
    expect(Action.new({ handler: vi.fn() }).ready).toBe(true);
  });
});

describe('run', () => {
  it('will resolve with handler result', async () => {
    const action = Action.new({ handler: () => 'ok' });

    expect(await action.run()).toBe('ok');
    expect(action.done).toBe(true);
    expect(action.pending).toBe(false);
  });

  it('will not run without a handler', async () => {
    const action = Action.new();

    expect(await action.run()).toBeUndefined();
    expect(action.pending).toBe(false);
  });

  it('will not re-enter while pending', async () => {
    const promise = mockPromise<string>();
    const handler = vi.fn(() => promise);
    const action = Action.new({ handler });

    const first = action.run();

    expect(action.pending).toBe(true);
    expect(action.ready).toBe(false);
    expect(await action.run()).toBeUndefined();
    expect(handler).toHaveBeenCalledTimes(1);

    promise.resolve('done');

    expect(await first).toBe('done');
    expect(action.pending).toBe(false);
  });

  it('will capture a thrown error', async () => {
    const error = new Error('nope');
    const action = Action.new({
      handler: () => {
        throw error;
      }
    });

    expect(await action.run()).toBeUndefined();
    expect(action.error).toBe(error);
    expect(action.done).toBe(false);
    expect(action.pending).toBe(false);
  });

  it('will wrap a thrown non-error', async () => {
    const action = Action.new({ handler: () => Promise.reject('nope') });

    await action.run();

    expect(action.error).toBeInstanceOf(Error);
    expect(action.error?.message).toBe('nope');
  });

  it('will clear error on next run', async () => {
    const handler = vi.fn().mockRejectedValueOnce(new Error('nope'));
    const action = Action.new({ handler });

    await action.run();
    expect(action.error).toBeDefined();

    await action.run();
    expect(action.error).toBeUndefined();
    expect(action.done).toBe(true);
  });
});

it('will dismiss error', async () => {
  const action = Action.new({ handler: () => Promise.reject(new Error()) });

  await action.run();
  action.dismiss();

  expect(action.error).toBeUndefined();
  await expect(action).toHaveUpdated('error');
});
