import { afterEach, expect, it, vi } from 'vitest';

import { journal, record } from '../../test.setup';
import { api } from './services';
import { Pull, Sync } from './sync';

// a Sync whose pull keeps each entry its after hook is handed - read with record(sync.pull)
class Logged extends Sync {
  pull = new (journal(Pull))();
}

afterEach(() => vi.restoreAllMocks());

it('will pull every page and end with its values', async () => {
  const sync = Logged.new({ token: 't1' });

  // awaiting an idle job runs next(); without end the result is its values - then excluded, its owner included
  expect(await sync.pull).toMatchObject({ cursor: 'p2', acked: 'p2', sync: { items: sync.items.get() } });
  expect(sync.items.get()).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  expect(record(sync.pull).map((entry) => [entry.id, entry.wrote])).toEqual([
    ['next#1', []],
    ['page#1', ['cursor']],
    ['page#2', ['cursor']],
    ['then#1', ['acked']]
  ]);

  // Feed's method stayed plain: page called it inline, and it reads from outside
  expect(sync.known('b')).toBe(true);
});

it('will ack once the last page is in', async () => {
  vi.spyOn(api, 'ack');

  await Sync.new({ token: 't1' }).pull;

  expect(api.ack).toHaveBeenCalledWith('p2', { signal: expect.any(AbortSignal) });
});

it('will start over after a failed sync', async () => {
  const page = api.page;

  vi.spyOn(api, 'page').mockImplementation(async (cursor, options) => {
    if (cursor == 'p2') throw new Error('offline');
    return page(cursor, options);
  });

  const sync = Sync.new({ token: 't1' });

  await expect(sync.pull.next()).rejects.toThrow('offline');

  // the feed keeps the first page - written to another Model; the exit hook forgot the cursor
  expect(sync.items.get()).toEqual([{ id: 'a' }, { id: 'b' }]);
  expect(sync.pull.cursor).toBe('');
});

it('will wait for a token before pulling', async () => {
  const sync = Logged.new();
  const done = sync.pull.next();

  await new Promise((resolve) => setTimeout(resolve));

  // page read the pending token: no entry yet, still running
  expect(sync.pull.then.status).toBe('running');
  expect(sync.pull.then.active).toBe('page');
  expect(record(sync.pull).map((entry) => entry.id)).toEqual(['next#1']);

  sync.token = 't1';

  await done;
  expect(record(sync.pull).map((entry) => entry.id)).toEqual(['next#1', 'page#1', 'page#2', 'then#1']);
});
