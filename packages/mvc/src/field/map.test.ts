import { mock, describe, it, expect } from 'bun:test';
import { watch } from '../observable';
import { State } from '../state';
import { flushMicrotasks as flush } from '../../test.setup';
import { map } from './map';

describe('factory', () => {
  it('will create empty map', () => {
    const items = map<string, number>();

    expect(items).toBeInstanceOf(Map);
    expect(items.size).toBe(0);
  });

  it('will accept entries', () => {
    const items = map([
      ['a', 1],
      ['b', 2]
    ]);

    expect(Array.from(items)).toEqual([
      ['a', 1],
      ['b', 2]
    ]);
  });

  it('will copy entries from initial iterable', () => {
    const source = new Map([['a', 1]]);
    const items = map(source);

    source.set('b', 2);

    expect(Array.from(items)).toEqual([['a', 1]]);
  });
});

describe('map', () => {
  it('will get and set values', () => {
    const items = map<string, number>();

    expect(items.set('a', 1)).toBe(items);
    expect(items.get('a')).toBe(1);
  });

  it('will delete values', () => {
    const items = map([['a', 1]]);

    expect(items.delete('a')).toBeTrue();
    expect(items.delete('a')).toBeFalse();
    expect(items.has('a')).toBeFalse();
  });

  it('will clear values', () => {
    const items = map([
      ['a', 1],
      ['b', 2]
    ]);

    items.clear();

    expect(items.size).toBe(0);
  });

  it('will support object keys', () => {
    const key = {};
    const items = map([[key, 'value']]);

    expect(items.get(key)).toBe('value');
  });

  it('will support undefined keys', () => {
    const items = map<undefined, string>();

    items.set(undefined, 'value');

    expect(items.get(undefined)).toBe('value');
  });

  it('will return snapshot from get with no args', () => {
    const items = map([['a', 1]]);
    const snapshot = items.get();

    items.set('b', 2);

    expect(Array.from(snapshot)).toEqual([['a', 1]]);
  });

  it('will unwrap nested get values in snapshot', () => {
    const inner = { get: () => 'unwrapped' };
    const items = map([['a', inner]]);

    expect(items.get().get('a')).toBe('unwrapped');
  });
});

describe('iteration', () => {
  it('will iterate entries', () => {
    const items = map([
      ['a', 1],
      ['b', 2]
    ]);

    expect(Array.from(items.entries())).toEqual([
      ['a', 1],
      ['b', 2]
    ]);
    expect(Array.from(items)).toEqual([
      ['a', 1],
      ['b', 2]
    ]);
  });

  it('will iterate keys', () => {
    const items = map([
      ['a', 1],
      ['b', 2]
    ]);

    expect(Array.from(items.keys())).toEqual(['a', 'b']);
  });

  it('will iterate values', () => {
    const items = map([
      ['a', 1],
      ['b', 2]
    ]);

    expect(Array.from(items.values())).toEqual([1, 2]);
  });

  it('will support forEach', () => {
    const items = map([['a', 1]]);
    const calls: unknown[] = [];
    const thisArg = {};

    items.forEach(function (this: unknown, value, key, source) {
      calls.push([this, value, key, source]);
    }, thisArg);

    expect(calls).toEqual([[thisArg, 1, 'a', items]]);
  });
});

describe('subscriptions', () => {
  it('will fire on get(key) only when that key changes', async () => {
    const items = map([
      ['a', 1],
      ['b', 2]
    ]);
    const fn = mock();

    watch(items, ($) => {
      void $.get('a');
      fn();
    });
    fn.mockClear();

    items.set('b', 3);
    await flush();
    expect(fn).not.toBeCalled();

    items.set('a', 2);
    await flush();
    expect(fn).toHaveBeenCalled();
  });

  it('will fire on has(key) when that key changes', async () => {
    const items = map<string, number>();
    const fn = mock();

    watch(items, ($) => {
      void $.has('a');
      fn();
    });
    fn.mockClear();

    items.set('b', 1);
    await flush();
    expect(fn).not.toBeCalled();

    items.set('a', 1);
    await flush();
    expect(fn).toHaveBeenCalled();
  });

  it('will fire on size when shape changes', async () => {
    const items = map([['a', 1]]);
    const fn = mock();

    watch(items, ($) => {
      void $.size;
      fn();
    });
    fn.mockClear();

    items.set('a', 2);
    await flush();
    expect(fn).not.toBeCalled();

    items.set('b', 2);
    await flush();
    expect(fn).toHaveBeenCalled();
  });

  it('will fire on iteration when values change', async () => {
    const items = map([
      ['a', 1],
      ['b', 2]
    ]);
    const fn = mock();

    watch(items, ($) => {
      Array.from($.values());
      fn();
    });
    fn.mockClear();

    items.set('b', 3);
    await flush();
    expect(fn).toHaveBeenCalled();
  });

  it('will fire on keys when shape changes only', async () => {
    const items = map([['a', 1]]);
    const fn = mock();

    watch(items, ($) => {
      Array.from($.keys());
      fn();
    });
    fn.mockClear();

    items.set('a', 2);
    await flush();
    expect(fn).not.toBeCalled();

    items.set('b', 2);
    await flush();
    expect(fn).toHaveBeenCalled();
  });

  it('will fire on deleted key subscribers', async () => {
    const items = map([['a', 1]]);
    const fn = mock();

    watch(items, ($) => {
      void $.get('a');
      fn();
    });
    fn.mockClear();

    items.delete('a');
    await flush();
    expect(fn).toHaveBeenCalled();
  });

  it('will not fire when setting unchanged value', async () => {
    const items = map([['a', 1]]);
    const fn = mock();

    watch(items, ($) => {
      void $.get('a');
      fn();
    });
    fn.mockClear();

    items.set('a', 1);
    await flush();
    expect(fn).not.toBeCalled();
  });

  it('will track nested observable values', async () => {
    class Counter extends State {
      count = 0;
    }

    const counter = Counter.new();
    const items = map([['counter', counter]]);
    const fn = mock();

    watch(items, ($) => {
      void $.get('counter')?.count;
      fn();
    });
    fn.mockClear();

    counter.count++;
    await flush();
    expect(fn).toHaveBeenCalled();
  });
});
