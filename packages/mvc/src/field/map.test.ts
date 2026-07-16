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

describe('keyed factory', () => {
  it('will spawn value from key on add', () => {
    const items = map((key: string) => ({ key }));
    const value = items.add('a');

    expect(value).toEqual({ key: 'a' });
    expect(items.get('a')).toBe(value);
  });

  it('will throw if key is already occupied', () => {
    const make = mock((key: string) => ({ key }));
    const items = map(make);

    items.add('a');

    expect(() => items.add('a')).toThrow(
      'Key is already occupied; use set() to replace.'
    );
    expect(make).toHaveBeenCalledTimes(1);
  });

  it('will respawn value via set with key alone', () => {
    const make = mock((key: string) => ({ key }));
    const items = map(make);

    const first = items.add('a');

    items.set('a');

    expect(make).toHaveBeenCalledTimes(2);
    expect(items.get('a')).not.toBe(first);
    expect(items.get('a')).toEqual({ key: 'a' });
  });

  it('will throw on set with key alone without factory', () => {
    const items = map<string, number>();

    expect(() => (items as any).set('a')).toThrow(
      'set(key) alone requires a factory.'
    );
  });

  it('will derive key from value when omitted', () => {
    const items = map(() => ({ toString: () => 'thing' }));
    const value = items.add();

    expect(items.get('thing')).toBe(value);
  });

  it('will not key on object input', () => {
    class Entry extends State {
      n = 0;
    }

    const make = mock((data: { n: number }) => Entry.new(data));
    const items = map(make);

    const first = items.add({ n: 1 });
    const second = items.add({ n: 1 });

    expect(make).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);
    expect(items.size).toBe(2);
    expect(items.get(String(first))).toBe(first);
    expect(items.get(String(second))).toBe(second);
  });

  it('will destroy orphaned state on derived key collision', () => {
    class Fixed extends State {
      toString() {
        return 'fixed';
      }
    }

    const made: Fixed[] = [];
    const items = map(() => {
      const next = Fixed.new();
      made.push(next);
      return next;
    });

    items.add();

    expect(() => items.add()).toThrow(
      'Key is already occupied; use set() to replace.'
    );
    expect(made[0].get(null)).toBe(false);
    expect(made[1].get(null)).toBe(true);
    expect(items.size).toBe(1);
  });

  it('will fire events on add', async () => {
    const items = map((key: string) => key.toUpperCase());
    const fn = mock();

    watch(items, ($) => {
      void $.size;
      fn();
    });
    fn.mockClear();

    items.add('a');
    await flush();
    expect(fn).toHaveBeenCalled();
  });

  it('will throw if created without factory', () => {
    const items = map<string, number>();

    expect(() => (items as any).add('a')).toThrow(
      'add() requires a map created with a factory.'
    );
  });
});

describe('class factory', () => {
  class Item extends State {
    value = 0;
  }

  it('will instantiate class on add', () => {
    const items = map(Item);
    const item = items.add();

    expect(item).toBeInstanceOf(Item);
    expect(items.get(String(item))).toBe(item);
  });

  it('will pass key to constructor', () => {
    class Product extends State {
      id: string;

      constructor(id?: string) {
        super();
        this.id = id || '';
      }
    }

    const items = map(Product);
    const item = items.add('sku_123');

    expect(item.id).toBe('sku_123');
    expect(items.get('sku_123')).toBe(item);
  });

  it('will assign object input to instance', () => {
    const items = map(Item);
    const item = items.add({ value: 5 });

    expect(item.value).toBe(5);
    expect(items.get(String(item))).toBe(item);
  });

  it('will respawn instance via set with key alone', () => {
    const items = map(Item);
    const item = items.add('a');

    items.set('a');

    const next = items.get('a')!;

    expect(item.get(null)).toBe(true);
    expect(next).toBeInstanceOf(Item);
    expect(next).not.toBe(item);
  });

  it('will key each instance by natural id', () => {
    const items = map(Item);
    const a = items.add();
    const b = items.add();

    expect(items.size).toBe(2);
    expect(items.get(String(a))).toBe(a);
    expect(items.get(String(b))).toBe(b);
  });

  it('will destroy instance on delete', () => {
    const items = map(Item);
    const item = items.add();

    expect(item.get(null)).toBe(false);

    items.delete(String(item));

    expect(item.get(null)).toBe(true);
  });
});

describe('ownership', () => {
  class Item extends State {
    value = 0;
  }

  it('will destroy spawned state on delete', () => {
    const items = map((key: string) => Item.new());
    const item = items.add('a');

    expect(item.get(null)).toBe(false);

    items.delete('a');

    expect(item.get(null)).toBe(true);
  });

  it('will destroy spawned state on clear', () => {
    const items = map((key: string) => Item.new());
    const a = items.add('a');
    const b = items.add('b');

    items.clear();

    expect(a.get(null)).toBe(true);
    expect(b.get(null)).toBe(true);
  });

  it('will destroy spawned state when replaced via set', () => {
    const items = map((key: string) => Item.new());
    const spawned = items.add('a');
    const guest = Item.new();

    items.set('a', guest);

    expect(spawned.get(null)).toBe(true);
    expect(guest.get(null)).toBe(false);
  });

  it('will destroy spawned state on respawn', () => {
    const items = map((key: string) => Item.new());
    const first = items.add('a');

    items.set('a');

    expect(first.get(null)).toBe(true);
    expect(items.get('a')).not.toBe(first);
    expect(items.get('a')).toBeInstanceOf(Item);
  });

  it('will not destroy value provided via set', () => {
    const items = map((key: string) => Item.new());
    const guest = Item.new();

    items.set('a', guest);
    items.delete('a');

    expect(guest.get(null)).toBe(false);
  });

  it('will not destroy spawned value set to itself', () => {
    const items = map((key: string) => Item.new());
    const spawned = items.add('a');

    items.set('a', spawned);
    items.delete('a');

    expect(spawned.get(null)).toBe(true);
  });

  it('will ignore plain spawned values', () => {
    const items = map((key: string) => ({ key }));

    items.add('a');

    expect(items.delete('a')).toBeTrue();
    expect(items.size).toBe(0);
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
