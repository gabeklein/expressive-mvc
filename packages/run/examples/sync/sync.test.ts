import { afterEach, expect, it, vi } from 'vitest';

import { api } from './services';
import { Sync } from './sync';

afterEach(() => vi.restoreAllMocks());

it('will pull every page and end with its values', async () => {
  const sync = Sync.new();

  // awaiting an idle instance runs next(); without end the result is the values, then excluded
  expect(await sync).toEqual({ items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], cursor: 'p2' });
  expect(sync.then.record.map((entry) => entry.id)).toEqual(['next#1', 'pull#1', 'pull#2', 'then#1']);

  // Feed's method stayed plain: pull called it inline, and it reads from outside
  expect(sync.known('b')).toBe(true);
});

it('will ack once the last page is in', async () => {
  vi.spyOn(api, 'ack');

  await Sync.new();

  expect(api.ack).toHaveBeenCalledWith('p2', { signal: expect.any(AbortSignal) });
});

it('will start over after a failed sync', async () => {
  const page = api.page;

  vi.spyOn(api, 'page').mockImplementation(async (cursor, options) => {
    if (cursor == 'p2') throw new Error('offline');
    return page(cursor, options);
  });

  const sync = Sync.new();

  await expect(sync.next()).rejects.toThrow('offline');

  // the light journal keeps the first page; the exit option forgot the cursor
  expect(sync.items.get()).toEqual([{ id: 'a' }, { id: 'b' }]);
  expect(sync.cursor).toBe('');
});
