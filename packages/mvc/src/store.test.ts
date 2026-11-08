import { beforeAll, describe, expect, it, vi } from 'vitest';

let store: typeof import('./store');
let observable: typeof import('./observable');

beforeAll(async () => {
  vi.resetModules();
  observable = await vi.importActual('./observable');
  store = await vi.importActual('./store');
});

function managed<T extends object>(data: T) {
  store.manage(data);
  observable.event(data);

  const updates: unknown[] = [];

  observable.listener(data, (key) => {
    if (typeof key == 'string') updates.push(key);
  });

  return { data, updates };
}

describe('manage', () => {
  it('will manage own values of a plain object', () => {
    const { data, updates } = managed({ foo: 1 });

    data.foo = 2;

    expect(data.foo).toBe(2);
    expect(updates).toEqual(['foo']);
    expect(store.entries(data)).toEqual([['foo', 2]]);
  });

  it('will not manage _ keys or then', () => {
    const { data, updates } = managed({ _foo: 1, then: 2 });

    data._foo = 3;
    data.then = 4;

    expect(data._foo).toBe(3);
    expect(data.then).toBe(4);
    expect(updates).toEqual([]);
    expect(store.entries(data)).toEqual([]);
  });
});

describe('access', () => {
  it('will suspend until a required value is set', async () => {
    const data = {};

    store.apply(data, 'foo', {});
    observable.event(data);

    let thrown: unknown;

    try {
      store.access(data, 'foo', true);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(Promise);

    store.update(data, 'foo', 'bar');

    await expect(thrown).resolves.toBe('bar');
  });
});

describe('compute', () => {
  it('will derive from managed values', async () => {
    const { data } = managed({ foo: 1 } as { foo: number; double?: number });

    store.compute(data, 'double', (self: typeof data) => self.foo * 2);

    expect(data.double).toBe(2);

    data.foo = 2;
    await Promise.resolve();

    expect(data.double).toBe(4);
  });
});

describe('values', () => {
  it('will export values, drilling into get()', () => {
    const { data } = managed({ foo: 1, bar: { get: () => 'baz' } });

    expect(store.values(data)).toEqual({ foo: 1, bar: 'baz' });
  });
});
