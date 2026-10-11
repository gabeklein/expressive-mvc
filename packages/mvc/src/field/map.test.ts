import { vi, describe, it, expect } from 'vitest';
import { State } from '../state';
import { fires } from '../../test.setup';
import { get } from './get';
import { map } from './map';

function managed<K, V>(
  entries?: Iterable<readonly [K, V]> | false | null
): map.Insert<K, V>;

function managed<A extends [unknown, ...unknown[]], V>(
  make: (...args: A) => V
): map.Create<A, V>;

function managed(...args: any[]): any {
  return new map.Managed(args[0]);
}

const ab = (): [string, number][] => [['a', 1], ['b', 2]];

describe('factory', () => {
  it('will create empty map of class identity', () => {
    const items = managed<string, number>();

    expect(items).toBeInstanceOf(Map);
    expect(items).toBeInstanceOf(map.Managed);
    expect(managed((key: string) => key)).toBeInstanceOf(map.Managed);
    expect(items.size).toBe(0);
  });

  it('will accept entries', () => {
    expect(Array.from(managed(ab()))).toEqual(ab());
  });

  it('will copy entries from initial iterable', () => {
    const source = new Map([['a', 1]]);
    const items = managed(source);

    source.set('b', 2);

    expect(Array.from(items)).toEqual([['a', 1]]);
  });

  it('will treat falsy initial as empty', () => {
    class Test extends State {
      items = map<string, number>(null);
    }

    expect(managed<string, number>(null).size).toBe(0);
    expect(managed<string, number>(false).size).toBe(0);
    expect(Test.new().items.size).toBe(0);
  });
});

describe('map', () => {
  it('will get, set, delete and clear values', () => {
    const items = managed<string, number>();

    expect(items.set('a', 1)).toBe(items);
    expect(items.get('a')).toBe(1);
    expect(items.delete('a')).toBe(true);
    expect(items.delete('a')).toBe(false);
    expect(items.has('a')).toBe(false);

    items.set('a', 1).set('b', 2).clear();

    expect(items.size).toBe(0);
  });

  it('will support object and undefined keys', () => {
    const key = {};
    const items = managed<object | undefined, string>([[key, 'value']]);

    items.set(undefined, 'other');

    expect(items.get(key)).toBe('value');
    expect(items.get(undefined)).toBe('other');
  });

  it('will return snapshot from get with no args', () => {
    const items = managed([['a', 1]]);
    const snapshot = items.get();

    items.set('b', 2);

    expect(Array.from(snapshot)).toEqual([['a', 1]]);
  });

  it('will unwrap nested get values in snapshot', () => {
    const inner = { get: () => 'unwrapped' };
    const items = managed([['a', inner]]);

    expect(items.get().get('a')).toBe('unwrapped');
  });

  it.each([
    ['insert', () => managed<string, number>()],
    ['create', () => managed((key: string) => ({ key }))]
  ])('will not define add in %s mode', (_, create) => {
    expect(() => (create() as any).add(1)).toThrow(TypeError);
  });
});

describe('iteration', () => {
  it('will iterate entries, keys and values', () => {
    const items = managed(ab());

    expect(Array.from(items.entries())).toEqual(ab());
    expect(Array.from(items)).toEqual(ab());
    expect(Array.from(items.keys())).toEqual(['a', 'b']);
    expect(Array.from(items.values())).toEqual([1, 2]);
  });

  it('will support forEach', () => {
    const items = managed([['a', 1]]);
    const calls: unknown[] = [];
    const thisArg = {};

    items.forEach(function (this: unknown, value, key, source) {
      calls.push([this, value, key, source]);
    }, thisArg);

    expect(calls).toEqual([[thisArg, 1, 'a', items]]);
  });
});

describe('create', () => {
  class Item extends State {
    value = 0;
  }

  it('will spawn value from key on set', () => {
    const items = managed((key: string) => ({ key }));

    expect(items.set('a')).toBe(items);
    expect(items.get('a')).toEqual({ key: 'a' });
  });

  it('will pass arguments through to factory', () => {
    const items = managed((key: string, times: number) => key.repeat(times));

    items.set('ab', 2);

    expect(items.get('ab')).toBe('abab');
  });

  it('will replace occupied key', () => {
    const make = vi.fn((key: string) => new Item());
    const items = managed(make);

    items.set('a');
    const first = items.get('a')!;

    items.set('a');
    const second = items.get('a')!;

    expect(make).toHaveBeenCalledTimes(2);
    expect(second).not.toBe(first);
    expect(first.get(null)).toBe(true);
    expect(second.get(null)).toBe(false);
    expect(items.size).toBe(1);
  });

  it('will destroy owned state on delete and clear', () => {
    const items = managed((key: string) => new Item());
    const [a, b, c] = ['a', 'b', 'c'].map((key) => items.set(key).get(key)!);

    items.delete('a');

    expect(a.get(null)).toBe(true);
    expect(b.get(null)).toBe(false);

    items.clear();

    expect(b.get(null)).toBe(true);
    expect(c.get(null)).toBe(true);
  });

  it('will pass guest through factory unowned', () => {
    const items = managed(
      (key: string, value?: Item) => value || new Item()
    );
    const guest = Item.new();

    items.set('a', guest);
    items.set('b');

    const owned = items.get('b')!;

    items.delete('a');
    items.delete('b');

    expect(guest.get(null)).toBe(false);
    expect(owned.get(null)).toBe(true);
  });

  it('will ignore plain values', () => {
    const items = managed((key: string) => ({ key }));

    items.set('a');

    expect(items.delete('a')).toBe(true);
    expect(items.size).toBe(0);
  });
});

describe('transforms', () => {
  it('will map values, keys and entries through callback', () => {
    const items = managed(ab());

    expect(Array.from(items.values((value, key) => `${key}:${value * 2}`))).toEqual(['a:2', 'b:4']);
    expect(Array.from(items.keys((key) => key.toUpperCase()))).toEqual(['A', 'B']);
    expect(Array.from(items.entries(([key, value]) => key + value))).toEqual(['a1', 'b2']);
  });

  it('will reflect current state on each iteration', () => {
    const items = managed([['a', 1]]);
    const values = items.values((value) => value);

    expect(Array.from(values)).toEqual([1]);

    items.set('b', 2);

    expect(Array.from(values)).toEqual([1, 2]);
  });

  it('will survive break in for-of', () => {
    const values = managed(ab()).values((value) => value);

    for (const value of values) if (value) break;

    expect(Array.from(values)).toEqual([1, 2]);
  });

  it('will skip entry when callback throws false', () => {
    const items = managed([...ab(), ['c', 3]]);

    const odd = items.values((value) => {
      if (value % 2 == 0) throw false;
      return value;
    });

    expect(Array.from(odd)).toEqual([1, 3]);
  });

  it('will rethrow real errors from callback', () => {
    const items = managed([['a', 1]]);
    const boom = items.values(() => {
      throw new Error('boom');
    });

    expect(() => Array.from(boom)).toThrow('boom');
  });
});

describe('adoption', () => {
  class Item extends State {
    value = 0;
  }

  class Owner extends State {
    items = map<string, Item>();
    spawn = map((key: string) => new Item());
  }

  class Member extends State {
    owner = get(Parent);
  }

  class Parent extends State {
    members = map((key: string) => new Member());
    guests = map<string, Member>();
  }

  it('will parent spawned state to owner', () => {
    const first = Parent.new();
    const second = Parent.new();

    expect(first.members.set('a').get('a')!.owner).toBe(first);
    expect(second.members.set('a').get('a')!.owner).toBe(second);
  });

  it('will destroy owned members but not guests with owner', () => {
    const owner = Owner.new();
    const a = owner.spawn.set('a').get('a')!;
    const b = owner.spawn.set('b').get('b')!;
    const guest = Item.new();

    owner.items.set('g', guest);
    owner.set(null);

    expect(a.get(null)).toBe(true);
    expect(b.get(null)).toBe(true);
    expect(guest.get(null)).toBe(false);
    expect(owner.spawn.size).toBe(0);
  });

  it('will evict guest when it dies', () => {
    const owner = Owner.new();
    const guest = Item.new();

    owner.items.set('g', guest);
    guest.set(null);

    expect(owner.items.has('g')).toBe(false);
    expect(guest.get(null)).toBe(true);
  });

  it('will evict every key of a destroyed value', () => {
    const owner = Owner.new();
    const item = new Item();

    owner.items.set('a', item);
    owner.items.set('b', item);
    owner.items.delete('a');

    expect(item.get(null)).toBe(true);
    expect(owner.items.size).toBe(0);
  });

  it('will not destroy fresh value set to itself', () => {
    const owner = Owner.new();
    const item = new Item();

    owner.items.set('a', item);
    owner.items.set('a', item);
    owner.items.delete('a');

    expect(item.get(null)).toBe(true);
  });

  it('will activate fresh state on store', () => {
    const ready = vi.fn();

    class Entry extends State {
      protected new() {
        ready();
      }
    }

    managed<string, Entry>().set('a', new Entry());

    expect(ready).toHaveBeenCalled();
  });

  it('will throw on field reassignment', () => {
    const owner = Owner.new();

    expect(() => ((owner as any).items = null)).toThrow('is read-only');
    expect(owner.items).toBeInstanceOf(Map);
  });

  it('will adopt fresh value stored via set', () => {
    const owner = Parent.new();
    const fresh = new Member();

    owner.guests.set('f', fresh);

    expect(fresh.owner).toBe(owner);

    owner.guests.delete('f');

    expect(fresh.get(null)).toBe(true);
  });

  it('will adopt entries present at activation', () => {
    class Member extends State {
      owner = get(Owner);
    }

    class Owner extends State {
      members = map([['a', new Member()]]);
    }

    const owner = Owner.new();

    expect(owner.members.get('a')!.owner).toBe(owner);
  });

  it('will adopt distinct map per instance', () => {
    const first = Owner.new();
    const second = Owner.new();

    expect(first.spawn).not.toBe(second.spawn);

    const item = first.spawn.set('a').get('a')!;

    second.set(null);

    expect(item.get(null)).toBe(false);

    first.set(null);

    expect(item.get(null)).toBe(true);
  });
});

describe('subscriptions', () => {
  type Items = map.Insert<string, number>;

  it.each<[string, ($: Items) => unknown, (items: Items) => unknown, number]>([
    ['will not fire get(key) when another key changes', ($) => $.get('a'), (items) => items.set('b', 3), 0],
    ['will fire get(key) when that key changes', ($) => $.get('a'), (items) => items.set('a', 2), 1],
    ['will fire get(key) when that key is deleted', ($) => $.get('a'), (items) => items.delete('a'), 1],
    ['will not fire get(key) when setting unchanged value', ($) => $.get('a'), (items) => items.set('a', 1), 0],
    ['will not fire has(key) when another key is added', ($) => $.has('c'), (items) => items.set('d', 1), 0],
    ['will fire has(key) when that key is added', ($) => $.has('c'), (items) => items.set('c', 1), 1],
    ['will not fire size when a value changes', ($) => $.size, (items) => items.set('a', 2), 0],
    ['will fire size when shape changes', ($) => $.size, (items) => items.set('c', 2), 1],
    ['will fire iteration when values change', ($) => Array.from($.values()), (items) => items.set('b', 3), 1],
    ['will not fire keys when values change', ($) => Array.from($.keys()), (items) => items.set('a', 2), 0],
    ['will fire keys when shape changes', ($) => Array.from($.keys()), (items) => items.set('c', 2), 1],
    ['will fire values transform when values change', ($) => Array.from($.values((v) => v)), (items) => items.set('a', 2), 1],
    ['will fire values transform when shape changes', ($) => Array.from($.values((v) => v)), (items) => items.set('c', 3), 1],
    ['will not fire keys transform when values change', ($) => Array.from($.keys((k) => k)), (items) => items.set('a', 2), 0],
    ['will fire keys transform when shape changes', ($) => Array.from($.keys((k) => k)), (items) => items.set('c', 3), 1]
  ])('%s', async (_, read, act, runs) => {
    expect(await fires(managed(ab()), read, act)).toBe(runs);
  });

  it('will track nested observable values', async () => {
    class Counter extends State {
      count = 0;
    }

    const counter = Counter.new();
    const items = managed([['counter', counter]]);

    expect(await fires(items, ($) => $.get('counter')?.count, () => counter.count++)).toBe(1);
  });
});
