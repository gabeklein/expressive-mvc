import { afterEach, expect, it, vi } from 'vitest';

import { api } from './services';
import { Sync } from './sync';

afterEach(() => vi.restoreAllMocks());

it('will pull every page and end with its values', async () => {
  const sync = Sync.new({ token: 't1' });

  // awaiting an idle instance runs next(); without end the result is the values, then excluded
  expect(await sync).toEqual({ items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], cursor: 'p2', token: 't1', acked: 'p2' });
  // Feed's method stayed plain: pull called it inline, and it reads from outside
  expect(sync.known('b')).toBe(true);
});

it('will ack once the last page is in', async () => {
  vi.spyOn(api, 'ack');

  await Sync.new({ token: 't1' });

  expect(api.ack).toHaveBeenCalledWith('p2', { signal: expect.any(AbortSignal) });
});

it('will start over after a failed sync', async () => {
  const page = api.page;

  vi.spyOn(api, 'page').mockImplementation(async (cursor, options) => {
    if (cursor == 'p2') throw new Error('offline');
    return page(cursor, options);
  });

  const sync = Sync.new({ token: 't1' });

  await expect(sync.next()).rejects.toThrow('offline');

  // the light journal keeps the first page; the exit option forgot the cursor
  expect(sync.items.get()).toEqual([{ id: 'a' }, { id: 'b' }]);
  expect(sync.cursor).toBe('');
});

it('will wait for a token before pulling', async () => {
  const sync = Sync.new();
  const done = sync.next();

  await new Promise((resolve) => setTimeout(resolve));

  // pull read the pending token: no entry yet, still running
  expect(sync.then.status).toBe('running');
  expect(sync.then.active).toBe('pull');
  expect(sync.items.size).toBe(0);

  sync.token = 't1';

  await done;
  expect(sync.items.size).toBe(3);
});
