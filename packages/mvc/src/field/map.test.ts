import { mock, describe, it, expect } from 'bun:test';
import { watch } from '../observable';
import { State } from '../state';
import { flushMicrotasks as flush } from '../../test.setup';
import { get } from './get';
import { map } from './map';

function hosted<K, V>(
  entries?: Iterable<readonly [K, V]> | null
): map.Insert<K, V>;

function hosted<A extends [unknown, ...unknown[]], V>(
  make: (...args: A) => V
): map.Create<A, V>;

function hosted(...args: any[]): any {
  class Host extends State {
    value = (map as any)(...args);
  }

  return Host.new().value;
}

describe('factory', () => {
  it('will create empty map', () => {
    const items = hosted<string, number>();

    expect(items).toBeInstanceOf(Map);
    expect(items.size).toBe(0);
  });

  it('will construct mode as class identity', () => {
    expect(hosted<string, number>()).toBeInstanceOf(map.Create);
    expect(hosted((key: string) => key)).toBeInstanceOf(map.Create);
    expect(hosted<string, number>()).toBeInstanceOf(Map);
  });

  it('will accept entries', () => {
    const items = hosted([
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
    const items = hosted(source);

    source.set('b', 2);

    expect(Array.from(items)).toEqual([['a', 1]]);
  });
});

describe('map', () => {
  it('will get and set values', () => {
    const items = hosted<string, number>();

    expect(items.set('a', 1)).toBe(items);
    expect(items.get('a')).toBe(1);
  });

  it('will delete values', () => {
    const items = hosted([['a', 1]]);

    expect(items.delete('a')).toBeTrue();
    expect(items.delete('a')).toBeFalse();
    expect(items.has('a')).toBeFalse();
  });

  it('will clear values', () => {
    const items = hosted([
      ['a', 1],
      ['b', 2]
    ]);

    items.clear();

    expect(items.size).toBe(0);
  });

  it('will support object keys', () => {
    const key = {};
    const items = hosted([[key, 'value']]);

    expect(items.get(key)).toBe('value');
  });

  it('will support undefined keys', () => {
    const items = hosted<undefined, string>();

    items.set(undefined, 'value');

    expect(items.get(undefined)).toBe('value');
  });

  it('will return snapshot from get with no args', () => {
    const items = hosted([['a', 1]]);
    const snapshot = items.get();

    items.set('b', 2);

    expect(Array.from(snapshot)).toEqual([['a', 1]]);
  });

  it('will unwrap nested get values in snapshot', () => {
    const inner = { get: () => 'unwrapped' };
    const items = hosted([['a', inner]]);

    expect(items.get().get('a')).toBe('unwrapped');
  });

  it('will not define add', () => {
    const items = hosted<string, number>();

    expect(() => (items as any).add(1)).toThrow(TypeError);
  });
});

describe('iteration', () => {
  it('will iterate entries', () => {
    const items = hosted([
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
    const items = hosted([
      ['a', 1],
      ['b', 2]
    ]);

    expect(Array.from(items.keys())).toEqual(['a', 'b']);
  });

  it('will iterate values', () => {
    const items = hosted([
      ['a', 1],
      ['b', 2]
    ]);

    expect(Array.from(items.values())).toEqual([1, 2]);
  });

  it('will support forEach', () => {
    const items = hosted([['a', 1]]);
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
    const items = hosted((key: string) => ({ key }));

    expect(items.set('a')).toBe(items);
    expect(items.get('a')).toEqual({ key: 'a' });
  });

  it('will pass arguments through to factory', () => {
    const items = hosted((key: string, times: number) => key.repeat(times));

    items.set('ab', 2);

    expect(items.get('ab')).toBe('abab');
  });

  it('will replace occupied key', () => {
    const make = mock((key: string) => Item.new());
    const items = hosted(make);

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

  it('will destroy spawned state on delete', () => {
    const items = hosted((key: string) => Item.new());

    items.set('a');
    const item = items.get('a')!;

    expect(item.get(null)).toBe(false);

    items.delete('a');

    expect(item.get(null)).toBe(true);
  });

  it('will destroy spawned state on clear', () => {
    const items = hosted((key: string) => Item.new());

    items.set('a');
    items.set('b');

    const a = items.get('a')!;
    const b = items.get('b')!;

    items.clear();

    expect(a.get(null)).toBe(true);
    expect(b.get(null)).toBe(true);
  });

  it('will pass guest through factory unowned', () => {
    const items = hosted(
      (key: string, value?: Item) => value || Item.new()
    );
    const guest = Item.new();

    items.set('a', guest);
    items.set('b');

    const spawned = items.get('b')!;

    items.delete('a');
    items.delete('b');

    expect(guest.get(null)).toBe(false);
    expect(spawned.get(null)).toBe(true);
  });

  it('will ignore plain spawned values', () => {
    const items = hosted((key: string) => ({ key }));

    items.set('a');

    expect(items.delete('a')).toBeTrue();
    expect(items.size).toBe(0);
  });

  it('will not define add', () => {
    const items = hosted((key: string) => ({ key }));

    expect(() => (items as any).add()).toThrow(TypeError);
  });
});

describe('transforms', () => {
  it('will map values through callback', () => {
    const items = hosted([
      ['a', 1],
      ['b', 2]
    ]);

    const doubled = items.values((value, key) => `${key}:${value * 2}`);

    expect(Array.from(doubled)).toEqual(['a:2', 'b:4']);
  });

  it('will map keys and entries through callback', () => {
    const items = hosted([['a', 1]]);

    expect(Array.from(items.keys((key) => key.toUpperCase()))).toEqual(['A']);
    expect(Array.from(items.entries(([key, value]) => key + value))).toEqual([
      'a1'
    ]);
  });

  it('will iterate transform more than once', () => {
    const items = hosted([
      ['a', 1],
      ['b', 2]
    ]);

    const values = items.values((value) => value);

    expect(Array.from(values)).toEqual([1, 2]);
    expect(Array.from(values)).toEqual([1, 2]);
  });

  it('will reflect current state on each iteration', () => {
    const items = hosted([['a', 1]]);
    const values = items.values((value) => value);

    expect(Array.from(values)).toEqual([1]);

    items.set('b', 2);

    expect(Array.from(values)).toEqual([1, 2]);
  });

  it('will survive break in for-of', () => {
    const items = hosted([
      ['a', 1],
      ['b', 2]
    ]);

    const values = items.values((value) => value);

    for (const value of values) if (value) break;

    expect(Array.from(values)).toEqual([1, 2]);
  });

  it('will skip entry when callback throws false', () => {
    const items = hosted([
      ['a', 1],
      ['b', 2],
      ['c', 3]
    ]);

    const odd = items.values((value) => {
      if (value % 2 == 0) throw false;
      return value;
    });

    expect(Array.from(odd)).toEqual([1, 3]);
  });

  it('will rethrow real errors from callback', () => {
    const items = hosted([['a', 1]]);
    const boom = items.values(() => {
      throw new Error('boom');
    });

    expect(() => Array.from(boom)).toThrow('boom');
  });

  it('will track shape and values in effect', async () => {
    const items = hosted([['a', 1]]);
    const fn = mock();

    watch(items, ($) => {
      Array.from($.values((value) => value));
      fn();
    });
    fn.mockClear();

    items.set('a', 2);
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);

    items.set('b', 3);
    await flush();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('will track shape only through keys transform', async () => {
    const items = hosted([['a', 1]]);
    const fn = mock();

    watch(items, ($) => {
      Array.from($.keys((key) => key));
      fn();
    });
    fn.mockClear();

    items.set('a', 2);
    await flush();
    expect(fn).not.toHaveBeenCalled();

    items.set('b', 3);
    await flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('adoption', () => {
  class Item extends State {
    value = 0;
  }

  it('will parent spawned state to owner', () => {
    class Member extends State {
      owner = get(Owner);
    }

    class Owner extends State {
      members = map((key: string) => new Member());
    }

    const first = Owner.new();
    const second = Owner.new();

    expect(first.members.set('a').get('a')!.owner).toBe(first);
    expect(second.members.set('a').get('a')!.owner).toBe(second);
  });

  it('will destroy owned members with owner', () => {
    class Owner extends State {
      items = map((key: string) => new Item());
    }

    const owner = Owner.new();
    const a = owner.items.set('a').get('a')!;
    const b = owner.items.set('b').get('b')!;

    owner.set(null);

    expect(a.get(null)).toBe(true);
    expect(b.get(null)).toBe(true);
  });

  it('will not destroy guests with owner', () => {
    class Owner extends State {
      items = map<string, Item>();
    }

    const owner = Owner.new();
    const guest = Item.new();

    owner.items.set('g', guest);
    owner.set(null);

    expect(guest.get(null)).toBe(false);
  });

  it('will evict guest when it dies', () => {
    class Owner extends State {
      items = map<string, Item>();
    }

    const owner = Owner.new();
    const guest = Item.new();

    owner.items.set('g', guest);
    guest.set(null);

    expect(owner.items.has('g')).toBe(false);
    expect(guest.get(null)).toBe(true);
  });

  it('will evict every key of a destroyed value', () => {
    class Owner extends State {
      items = map<string, Item>();
    }

    const owner = Owner.new();
    const item = new Item();

    owner.items.set('a', item);
    owner.items.set('b', item);
    owner.items.delete('a');

    expect(item.get(null)).toBe(true);
    expect(owner.items.size).toBe(0);
  });

  it('will not destroy fresh value set to itself', () => {
    class Owner extends State {
      items = map<string, Item>();
    }

    const owner = Owner.new();
    const item = new Item();

    owner.items.set('a', item);
    owner.items.set('a', item);
    owner.items.delete('a');

    expect(item.get(null)).toBe(true);
  });

  it('will activate fresh state on store', () => {
    const ready = mock();

    class Entry extends State {
      protected new() {
        ready();
      }
    }

    const items = hosted<string, Entry>();

    items.set('a', new Entry());

    expect(ready).toHaveBeenCalled();
  });

  it('will throw on field reassignment', () => {
    class Owner extends State {
      items = map<string, Item>();
    }

    const owner = Owner.new();

    expect(() => ((owner as any).items = null)).toThrow('is read-only');
    expect(owner.items).toBeInstanceOf(Map);
  });

  it('will clear map when owner dies', () => {
    class Owner extends State {
      items = map((key: string) => new Item());
    }

    const owner = Owner.new();

    owner.items.set('a');
    owner.set(null);

    expect(owner.items.size).toBe(0);
  });

  it('will adopt fresh value stored via set', () => {
    class Member extends State {
      owner = get(Owner);
    }

    class Owner extends State {
      members = map<string, Member>();
    }

    const owner = Owner.new();
    const fresh = new Member();

    owner.members.set('f', fresh);

    expect(fresh.owner).toBe(owner);

    owner.members.delete('f');

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
    const member = owner.members.get('a')!;

    expect(member.owner).toBe(owner);
  });

  it('will adopt distinct map per instance', () => {
    class Owner extends State {
      items = map((key: string) => new Item());
    }

    const first = Owner.new();
    const second = Owner.new();

    expect(first.items).not.toBe(second.items);

    const item = first.items.set('a').get('a')!;

    second.set(null);

    expect(item.get(null)).toBe(false);

    first.set(null);

    expect(item.get(null)).toBe(true);
  });
});

describe('subscriptions', () => {
  it('will fire on get(key) only when that key changes', async () => {
    const items = hosted([
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
    const items = hosted<string, number>();
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
    const items = hosted([['a', 1]]);
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
    const items = hosted([
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
    const items = hosted([['a', 1]]);
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
    const items = hosted([['a', 1]]);
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
    const items = hosted([['a', 1]]);
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
    const items = hosted([['counter', counter]]);
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
