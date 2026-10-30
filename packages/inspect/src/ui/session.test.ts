import { Model } from '@expressive/mvc';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { flushMicrotasks } from '../../test.setup';
import { dispatch, type Call } from '../dispatch';
import { attach, inspect, journal } from '../index';
import { draft, Session } from './session';
import type { PageInfo } from './remote';
import type { Connection } from './socket';

class Composer extends Model {
  draft = '';
  count = 0;
}

class Holder extends Model {
  composer = new Composer();
}

function connection(send?: (call?: Call) => unknown) {
  const watchers: ((pages: PageInfo[] | { error: string }) => void)[] = [];
  const conn: Connection = {
    send: vi.fn(async (call?: Call) => (call ? dispatch(call) : [])),
    watch: (fn) => void watchers.push(fn),
    close: vi.fn()
  };
  if (send) conn.send = vi.fn(async (call?: Call) => send(call));
  return { conn, roster: (pages: PageInfo[] | { error: string }) => watchers.forEach((w) => w(pages)) };
}

/** The session exists before attach, like the real panel - it never inspects itself. */
function start(send?: (call?: Call) => unknown) {
  const session = Session.new();
  attach();
  const { conn, roster } = connection(send);
  return { session, conn, roster };
}

const PAGE = { id: 'p1', url: 'http://localhost/', title: 'App', top: true };

beforeEach(() => {
  journal.record({ level: 'keys' });
  globalThis.__EXPRESSIVE_INSPECT__ = inspect;
});

describe('Session', () => {
  it('will open, refresh, and arm recording on the single page', async () => {
    const { session, conn, roster } = start();
    Composer.new();
    const opening = session.open(conn);

    roster([PAGE]);
    await opening;

    expect(session.status).toBe('open');
    expect(session.page).toBe('p1');
    expect(session.nodes.map((n) => n.type)).toEqual(['Composer']);
    expect(session.models.map((m) => m.type)).toEqual(['Composer']);

    session.set(null);
  });

  it('will auto-select a single page and keep a listed one', async () => {
    const { session, conn, roster } = start();
    await session.open(conn);

    roster([PAGE, { ...PAGE, id: 'p2' }]);
    expect(session.page).toBe('');

    session.page = 'p1';
    roster([PAGE, { ...PAGE, id: 'p2' }]);
    expect(session.page).toBe('p1');

    roster([{ ...PAGE, id: 'p2' }]);
    expect(session.page).toBe('p2');

    session.set(null);
  });

  it('will report a denied join', async () => {
    const { session, conn, roster } = start();
    const opening = session.open(conn);

    roster({ error: 'Dev token mismatch.' });
    await opening;

    expect(session.status).toBe('denied');
    expect(session.error).toBe('Dev token mismatch.');

    session.set(null);
  });

  it('will report a failed open', async () => {
    const { session, conn } = start(() => {
      throw new Error('No pages connected.');
    });
    await session.open(conn);

    expect(session.status).toBe('closed');
    expect(session.error).toBe('No pages connected.');

    session.set(null);
  });

  it('will report a non-Error failure', async () => {
    const { session, conn } = start(() => {
      throw 'plain string';
    });
    await session.open(conn);
    expect(session.error).toBe('plain string');

    session.set(null);
  });

  it('will load instance values on expand and collapse', async () => {
    const { session, conn } = start();
    const composer = Composer.new();
    await session.open(conn);

    const id = String(composer);
    await session.expand(id);

    expect(session.expanded.has(id)).toBe(true);
    expect(session.values.get(id)).toMatchObject({ $ref: id, $type: 'Composer', draft: '', count: 0 });

    await session.expand(id);
    expect(session.expanded.has(id)).toBe(false);

    session.set(null);
  });

  it('will select and deselect an instance', async () => {
    const { session, conn } = start();
    const composer = Composer.new();
    await session.open(conn);

    session.select(String(composer));
    await flushMicrotasks();
    expect(session.selected).toBe(String(composer));
    expect(session.values.has(String(composer))).toBe(true);

    session.select(String(composer));
    expect(session.selected).toBe('');

    session.set(null);
  });

  it('will write a value and reload cached addresses', async () => {
    const { session, conn } = start();
    const composer = Composer.new();
    await session.open(conn);

    const id = String(composer);
    await session.expand(id);
    await session.write(`${id}.draft`, 'hello');

    expect(composer.draft).toBe('hello');
    expect(session.values.get(id)).toMatchObject({ draft: 'hello' });

    session.set(null);
  });

  it('will write through a nested address', async () => {
    const { session, conn } = start();
    const holder = Holder.new();
    await session.open(conn);

    const id = String(holder);
    await session.expand(id);
    await session.write(`${id}.composer.draft`, 'nested');

    expect(holder.composer.draft).toBe('nested');
    expect(session.values.get(id)).toMatchObject({ composer: { $ref: String(holder.composer) } });

    session.set(null);
  });

  it('will reload changed instances on poll', async () => {
    const { session, conn } = start();
    const composer = Composer.new();
    await session.open(conn);

    const id = String(composer);
    await session.expand(id);

    composer.draft = 'live';
    composer.count = 3;
    await session.poll();

    expect(session.values.get(id)).toMatchObject({ draft: 'live', count: 3 });

    session.set(null);
  });

  it('will refresh structure on destroy and periodically', async () => {
    const { session, conn } = start();
    const composer = Composer.new();
    await session.open(conn);

    expect(session.nodes).toHaveLength(1);

    composer.set(null);
    await session.poll();
    expect(session.nodes).toHaveLength(0);

    Composer.new();
    session.tick = 7;
    await session.poll();
    expect(session.nodes).toHaveLength(1);

    session.set(null);
  });

  it('will tolerate a frames call that fails', async () => {
    const { session, conn } = start((call) => {
      if (call && call[0].join('.') === 'journal.frames') throw new Error('broken');
      return call ? dispatch(call) : [];
    });
    await session.open(conn);
    await session.poll();
    expect(session.status).toBe('open');

    session.set(null);
  });

  it('will do nothing without a remote', async () => {
    const session = Session.new();
    await session.poll();
    await session.load('x');
    await session.write('x.y', 1);
    await session.refresh();
    await session.use('p2');
    expect(session.values.size).toBe(0);
    expect(session.page).toBe('p2');

    session.set(null);
  });

  it('will clear state when switching pages', async () => {
    const { session, conn } = start();
    const composer = Composer.new();
    await session.open(conn);

    const id = String(composer);
    await session.expand(id);
    session.select(id);
    await flushMicrotasks();

    session.page = 'p1';
    await session.use('p2');

    expect(session.page).toBe('p2');
    expect(session.values.size).toBe(0);
    expect(session.expanded.size).toBe(0);
    expect(session.selected).toBe('');

    await session.use('p2');
    expect(session.page).toBe('p2');

    session.set(null);
  });

  it('will drop a cached address that reads back undefined', async () => {
    const { session, conn } = start();
    await session.open(conn);

    session.values = new Map([['Missing-1', { kept: true }]]);
    await session.load('Missing-1');

    expect(session.values.has('Missing-1')).toBe(false);

    session.set(null);
  });

  it('will keep a value that was already loaded', async () => {
    const { session, conn } = start();
    const composer = Composer.new();
    await session.open(conn);

    const id = String(composer);
    await session.load(id);
    const before = session.values.get(id);
    await session.expand(id);
    expect(session.values.get(id)).toBe(before);

    session.set(null);
  });

  it('will poll on its interval', async () => {
    vi.useFakeTimers();
    const { session, conn } = start();
    Composer.new();
    await session.open(conn);

    await vi.advanceTimersByTimeAsync(250);
    expect(session.tick).toBe(1);

    session.set(null);
  });

  it('will clear its timer on destroy', async () => {
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const { session, conn } = start();
    await session.open(conn);

    expect(session._timer).toBeDefined();
    session.set(null);
    expect(clear).toHaveBeenCalledWith(session._timer);
  });

  it('will draft JSON when it parses and raw strings otherwise', () => {
    expect(draft('42')).toBe(42);
    expect(draft('true')).toBe(true);
    expect(draft('null')).toBeNull();
    expect(draft('{"a":1}')).toEqual({ a: 1 });
    expect(draft('[1,2]')).toEqual([1, 2]);
    expect(draft('"quoted"')).toBe('quoted');
    expect(draft('plain')).toBe('plain');
  });
});
