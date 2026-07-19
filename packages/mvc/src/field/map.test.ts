import { mock, describe, it, expect } from 'bun:test';
import { Component } from '../component';
import { watch } from '../observable';
import { State } from '../state';
import { flushMicrotasks as flush } from '../../test.setup';
import { get } from './get';
import { map } from './map';

function hosted<K, V>(
  entries?: Iterable<readonly [K, V]> | null
): State.Map<K, V>;
function hosted<T extends State>(
  Type: new (...args: any[]) => T
): State.Map.Factory<T, State.Map.Key<T> | State.Assign<T>>;
function hosted<V, I = string>(
  make: (input: I) => V,
  entries?: Iterable<readonly [string, V]> | null
): State.Map.Factory<V, I>;
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

describe('keyed factory', () => {
  it('will spawn value from key on add', () => {
    const items = hosted((key: string) => ({ key }));
    const value = items.add('a');

    expect(value).toEqual({ key: 'a' });
    expect(items.get('a')).toBe(value);
  });

  it('will throw if key is already occupied', () => {
    const make = mock((key: string) => ({ key }));
    const items = hosted(make);

    items.add('a');

    expect(() => items.add('a')).toThrow(
      'Key is already occupied; use set() to replace.'
    );
    expect(make).toHaveBeenCalledTimes(1);
  });

  it('will respawn value via set with key alone', () => {
    const make = mock((key: string) => ({ key }));
    const items = hosted(make);

    const first = items.add('a');

    items.set('a');

    expect(make).toHaveBeenCalledTimes(2);
    expect(items.get('a')).not.toBe(first);
    expect(items.get('a')).toEqual({ key: 'a' });
  });

  it('will throw on set with key alone without factory', () => {
    const items = hosted<string, number>();

    expect(() => (items as any).set('a')).toThrow(
      'set(key) alone requires a factory.'
    );
  });

  it('will derive key from value when omitted', () => {
    const items = hosted(() => ({ toString: () => 'thing' }));
    const value = items.add();

    expect(items.get('thing')).toBe(value);
  });

  it('will not key on object input', () => {
    class Entry extends State {
      n = 0;
    }

    const make = mock((data: { n: number }) => Entry.new(data));
    const items = hosted(make);

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
    const items = hosted(() => {
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
    const items = hosted((key: string) => key.toUpperCase());
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
    const items = hosted<string, number>();

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
    const items = hosted(Item);
    const item = items.add();

    expect(item).toBeInstanceOf(Item);
    expect(items.get(String(item))).toBe(item);
  });

  it('will assign string input to component key', () => {
    class Product extends Component {}

    const items = hosted(Product);
    const item = items.add('sku_123');

    expect(item.key).toBe('sku_123');
    expect(items.get('sku_123')).toBe(item);
  });

  it('will expose key to new lifecycle hook', () => {
    const loaded = mock();

    class Product extends Component {
      protected new() {
        loaded(this.key);
      }
    }

    const items = hosted(Product);

    items.add('sku_123');

    expect(loaded).toHaveBeenCalledWith('sku_123');
  });

  it('will skip key where instance cannot accept it', () => {
    const items = hosted(Item);
    const item = items.add('a');

    expect(Object.keys(item)).not.toContain('key');
    expect(items.get('a')).toBe(item);
  });

  it('will derive key from component override', () => {
    class Widget extends Component {
      override readonly key = 'custom';
    }

    const widgets = hosted(Widget);
    const widget = widgets.add();

    expect(widgets.get('custom')).toBe(widget);
  });

  it('will support Component via props channel', () => {
    class Widget extends Component {
      label = '';
    }

    const widgets = hosted(Widget);
    const byKey = widgets.add('w1');
    const byProps = widgets.add({ label: 'hello' });

    expect(byKey.key).toBe('w1');
    expect(widgets.get('w1')).toBe(byKey);
    expect(byProps.label).toBe('hello');
  });

  it('will assign object input to instance', () => {
    const items = hosted(Item);
    const item = items.add({ value: 5 });

    expect(item.value).toBe(5);
    expect(items.get(String(item))).toBe(item);
  });

  it('will respawn instance via set with key alone', () => {
    const items = hosted(Item);
    const item = items.add('a');

    items.set('a');

    const next = items.get('a')!;

    expect(item.get(null)).toBe(true);
    expect(next).toBeInstanceOf(Item);
    expect(next).not.toBe(item);
  });

  it('will key each instance by natural id', () => {
    const items = hosted(Item);
    const a = items.add();
    const b = items.add();

    expect(items.size).toBe(2);
    expect(items.get(String(a))).toBe(a);
    expect(items.get(String(b))).toBe(b);
  });

  it('will destroy instance on delete', () => {
    const items = hosted(Item);
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
    const items = hosted((key: string) => Item.new());
    const item = items.add('a');

    expect(item.get(null)).toBe(false);

    items.delete('a');

    expect(item.get(null)).toBe(true);
  });

  it('will destroy spawned state on clear', () => {
    const items = hosted((key: string) => Item.new());
    const a = items.add('a');
    const b = items.add('b');

    items.clear();

    expect(a.get(null)).toBe(true);
    expect(b.get(null)).toBe(true);
  });

  it('will destroy spawned state when replaced via set', () => {
    const items = hosted((key: string) => Item.new());
    const spawned = items.add('a');
    const guest = Item.new();

    items.set('a', guest);

    expect(spawned.get(null)).toBe(true);
    expect(guest.get(null)).toBe(false);
  });

  it('will destroy spawned state on respawn', () => {
    const items = hosted((key: string) => Item.new());
    const first = items.add('a');

    items.set('a');

    expect(first.get(null)).toBe(true);
    expect(items.get('a')).not.toBe(first);
    expect(items.get('a')).toBeInstanceOf(Item);
  });

  it('will not destroy value provided via set', () => {
    const items = hosted((key: string) => Item.new());
    const guest = Item.new();

    items.set('a', guest);
    items.delete('a');

    expect(guest.get(null)).toBe(false);
  });

  it('will not destroy spawned value set to itself', () => {
    const items = hosted((key: string) => Item.new());
    const spawned = items.add('a');

    items.set('a', spawned);
    items.delete('a');

    expect(spawned.get(null)).toBe(true);
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

  it('will ignore plain spawned values', () => {
    const items = hosted((key: string) => ({ key }));

    items.add('a');

    expect(items.delete('a')).toBeTrue();
    expect(items.size).toBe(0);
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
      members = map(Member);
    }

    const first = Owner.new();
    const second = Owner.new();

    expect(first.members.add('a').owner).toBe(first);
    expect(second.members.add('b').owner).toBe(second);
  });

  it('will destroy owned members with owner', () => {
    class Owner extends State {
      items = map(Item);
    }

    const owner = Owner.new();
    const a = owner.items.add('a');
    const b = owner.items.add('b');

    owner.set(null);

    expect(a.get(null)).toBe(true);
    expect(b.get(null)).toBe(true);
  });

  it('will not destroy guests with owner', () => {
    class Owner extends State {
      items = map(Item);
    }

    const owner = Owner.new();
    const guest = Item.new();

    owner.items.set('g', guest);
    owner.set(null);

    expect(guest.get(null)).toBe(false);
  });

  it('will clear map when owner dies', () => {
    class Owner extends State {
      items = map(Item);
    }

    const owner = Owner.new();
    const guest = Item.new();

    owner.items.add('a');
    owner.items.set('g', guest);
    owner.set(null);

    expect(owner.items.size).toBe(0);
    expect(guest.get(null)).toBe(false);
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
      items = map(Item);
    }

    const first = Owner.new();
    const second = Owner.new();

    expect(first.items).not.toBe(second.items);

    const item = first.items.add('x');

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
