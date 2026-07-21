import { mock, describe, it, expect } from 'bun:test';
import { State } from '../state';
import { flushMicrotasks as flush } from '../../test.setup';
import { watch } from '../observable';
import { get } from './get';
import { has } from './has';

function hosted<T>(initial?: Iterable<T> | null): has.List<T>;

function hosted<T extends State>(
  Type: new (...args: State.Args<T>) => T
): has.Pool<T, State.Args<T>>;

function hosted<T, A extends unknown[]>(
  make: (...args: A) => T
): has.Pool<T, A>;

function hosted(...args: any[]): any {
  class Host extends State {
    value = (has as any)(...args);
  }

  return Host.new().value;
}

describe('factory', () => {
  it('will create empty', () => {
    const list = hosted<number>();

    expect(list).toBeInstanceOf(has.List);
    expect(list.size).toBe(0);
    expect(list.get()).toEqual([]);
  });

  it('will accept array', () => {
    const list = hosted([1, 2, 3]);

    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('will accept any iterable', () => {
    function* gen() {
      yield 'a';
      yield 'b';
    }

    expect(hosted(gen()).get()).toEqual(['a', 'b']);
  });

  it('will copy from initial', () => {
    const source = [1, 2, 3];
    const list = hosted(source);

    source.push(4);

    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('will throw if assigned', () => {
    class Host extends State {
      value = has<number>();
    }

    const host = Host.new();

    expect(() => {
      // @ts-expect-error
      host.value = null;
    }).toThrow();
  });

  it('will clear when owner is destroyed', () => {
    class Host extends State {
      value = has([1, 2, 3]);
    }

    const host = Host.new();
    const list = host.value;

    host.set(null);

    expect(list.size).toBe(0);
  });
});

describe('get', () => {
  it('will return snapshot with no args', () => {
    const list = hosted([1, 2, 3]);
    const snap = list.get();

    expect(snap).toEqual([1, 2, 3]);

    snap.push(4);

    expect(list.size).toBe(3);
  });

  it('will unwrap nested get values in snapshot', () => {
    const inner = { get: () => 'unwrapped' };
    const list = hosted([inner]);

    expect(list.get()).toEqual(['unwrapped']);
  });

  it('will read by positive index', () => {
    const list = hosted(['a', 'b', 'c']);

    expect(list.get(1)).toBe('b');
  });

  it('will normalize negative index', () => {
    const list = hosted(['a', 'b', 'c']);

    expect(list.get(-1)).toBe('c');
    expect(list.get(-3)).toBe('a');
  });

  it('will return undefined for out-of-range index', () => {
    const list = hosted(['a', 'b']);

    expect(list.get(5)).toBeUndefined();
    expect(list.get(-5)).toBeUndefined();
  });

  it('will read range with start, end', () => {
    const list = hosted([10, 20, 30, 40]);

    expect(list.get(1, 3)).toEqual([20, 30]);
  });

  it('will normalize negative start in range', () => {
    const list = hosted([10, 20, 30, 40]);

    expect(list.get(-2, 4)).toEqual([30, 40]);
  });

  it('will clamp end to length in range', () => {
    const list = hosted([1, 2]);

    expect(list.get(0, 99)).toEqual([1, 2]);
  });

  it('will return first match for predicate', () => {
    const list = hosted([1, 2, 3, 4]);

    expect(list.get((v) => v > 2)).toBe(3);
  });

  it('will return undefined when predicate matches nothing', () => {
    const list = hosted([1, 2, 3]);

    expect(list.get((v) => v > 99)).toBeUndefined();
  });
});

describe('set', () => {
  it('will replace value at index', () => {
    const list = hosted(['a', 'b', 'c']);

    list.set(1, 'B');

    expect(list.get()).toEqual(['a', 'B', 'c']);
  });

  it('will normalize negative index', () => {
    const list = hosted(['a', 'b', 'c']);

    list.set(-1, 'C');

    expect(list.get()).toEqual(['a', 'b', 'C']);
  });

  it('will not write out-of-range positive', () => {
    const list = hosted(['a']);

    list.set(5, 'x');

    expect(list.get()).toEqual(['a']);
  });

  it('will not write out-of-range negative', () => {
    const list = hosted(['a']);

    list.set(-5, 'x');

    expect(list.get()).toEqual(['a']);
  });

  it('will not notify for unchanged value', async () => {
    const list = hosted(['a']);
    const fn = mock();

    watch(list, fn);
    fn.mockClear();

    list.set(0, 'a');
    await flush();

    expect(fn).not.toHaveBeenCalled();
  });
});

describe('put', () => {
  it('will insert at index, shifting subsequent', () => {
    const list = hosted([1, 2, 4]);

    list.put(2, 3);

    expect(list.get()).toEqual([1, 2, 3, 4]);
  });

  it('will insert multiple', () => {
    const list = hosted([1, 4]);

    list.put(1, 2, 3);

    expect(list.get()).toEqual([1, 2, 3, 4]);
  });

  it('will append when index equals length', () => {
    const list = hosted([1, 2]);

    list.put(2, 3);

    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('will normalize negative index', () => {
    const list = hosted([1, 4]);

    list.put(-1, 2, 3);

    expect(list.get()).toEqual([1, 2, 3, 4]);
  });

  it('will not notify when no items provided', async () => {
    const list = hosted([1, 2]);
    const fn = mock();

    watch(list, fn);
    fn.mockClear();

    list.put(0);
    await flush();

    expect(fn).not.toHaveBeenCalled();
  });
});

describe('push', () => {
  it('will append and return new length', () => {
    const list = hosted([1]);

    expect(list.push(2, 3)).toBe(3);
    expect(list.get()).toEqual([1, 2, 3]);
  });
});

describe('pop', () => {
  it('will remove from tail by default', () => {
    const list = hosted([1, 2, 3]);

    expect(list.pop()).toBe(3);
    expect(list.get()).toEqual([1, 2]);
  });

  it('will remove at index', () => {
    const list = hosted([1, 2, 3]);

    expect(list.pop(0)).toBe(1);
    expect(list.get()).toEqual([2, 3]);
  });

  it('will remove a count and return array', () => {
    const list = hosted([1, 2, 3, 4]);

    expect(list.pop(1, 2)).toEqual([2, 3]);
    expect(list.get()).toEqual([1, 4]);
  });

  it('will normalize negative index', () => {
    const list = hosted([1, 2, 3]);

    expect(list.pop(-2)).toBe(2);
    expect(list.get()).toEqual([1, 3]);
  });

  it('will return undefined on empty list', () => {
    const list = hosted<number>();

    expect(list.pop()).toBeUndefined();
  });
});

describe('clear', () => {
  it('will remove all items', () => {
    const list = hosted([1, 2, 3]);

    list.clear();

    expect(list.size).toBe(0);
  });

  it('will not notify on empty list', async () => {
    const list = hosted<number>();
    const fn = mock();

    watch(list, fn);
    fn.mockClear();

    list.clear();
    await flush();

    expect(fn).not.toHaveBeenCalled();
  });
});

describe('iteration', () => {
  it('will iterate via for-of', () => {
    const out: number[] = [];

    for (const v of hosted([1, 2, 3])) out.push(v);

    expect(out).toEqual([1, 2, 3]);
  });

  it('will spread', () => {
    expect([...hosted(['a', 'b'])]).toEqual(['a', 'b']);
  });
});

describe('map', () => {
  it('will produce a plain array', () => {
    const list = hosted([1, 2, 3]);
    const out = list.map((v) => v * 2);

    expect(out).toEqual([2, 4, 6]);
    expect(Array.isArray(out)).toBe(true);
  });

  it('will skip results matching ignore value', () => {
    const list = hosted([1, 2, 3, 4]);
    const out = list.map((v) => (v % 2 ? v : null), null);

    expect(out).toEqual([1, 3]);
  });

  it('will receive index and list', () => {
    const list = hosted(['a']);
    const fn = mock((_v: string, _i: number, _l: unknown) => 0);

    list.map(fn);

    expect(fn).toHaveBeenCalledWith('a', 0, list);
  });
});

describe('filter', () => {
  it('will return matching items', () => {
    const list = hosted([1, 2, 3, 4]);

    expect(list.filter((v) => v > 2)).toEqual([3, 4]);
  });
});

describe('any / all', () => {
  it('will return true when match exists', () => {
    expect(hosted([1, 2, 3]).any((v) => v > 2)).toBe(true);
  });

  it('will return false when no match', () => {
    expect(hosted([1, 2, 3]).any((v) => v > 99)).toBe(false);
  });

  it('will return boolean independent of value truthiness', () => {
    const list = hosted([1, 0, 2]);

    expect(list.any((v) => v === 0)).toBe(true);
  });

  it('will return true when predicate true for every item', () => {
    expect(hosted([2, 4, 6]).all((v) => v % 2 === 0)).toBe(true);
  });

  it('will return false on first failure', () => {
    expect(hosted([2, 3, 4]).all((v) => v % 2 === 0)).toBe(false);
  });

  it('will return true on empty list', () => {
    expect(hosted<number>().all((v) => v > 0)).toBe(true);
  });
});

describe('subscriptions', () => {
  it('will update on size when length changes', async () => {
    const list = hosted([1, 2]);
    const fn = mock();

    watch(list, ($) => {
      void $.size;
      fn();
    });
    fn.mockClear();

    list.push(3);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update on get(i) only when that index changes', async () => {
    const list = hosted(['a', 'b', 'c']);
    const fn = mock();

    watch(list, ($) => {
      void $.get(1);
      fn();
    });
    fn.mockClear();

    list.set(0, 'A');
    await flush();

    expect(fn).not.toHaveBeenCalled();

    list.set(1, 'B');
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update on iteration when any index changes', async () => {
    const list = hosted([1, 2, 3]);
    const fn = mock();

    watch(list, ($) => {
      for (const _ of $) void _;
      fn();
    });
    fn.mockClear();

    list.set(1, 99);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update on iteration when length grows', async () => {
    const list = hosted([1, 2]);
    const fn = mock();

    watch(list, ($) => {
      for (const _ of $) void _;
      fn();
    });
    fn.mockClear();

    list.push(3);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update any() with no match on append', async () => {
    const list = hosted([1, 2, 3]);
    const fn = mock();

    watch(list, ($) => {
      void $.any((v) => v > 99);
      fn();
    });
    fn.mockClear();

    list.push(100);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update all() when appended item violates predicate', async () => {
    const list = hosted([2, 4]);
    const fn = mock();

    watch(list, ($) => {
      void $.all((v) => v % 2 === 0);
      fn();
    });
    fn.mockClear();

    list.push(3);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update get(predicate) when earlier item becomes candidate', async () => {
    const list = hosted([1, 2, 3]);
    const fn = mock();

    watch(list, ($) => {
      void $.get((v) => v > 2);
      fn();
    });
    fn.mockClear();

    list.set(0, 99);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will subscribe get(start, end) to indices in range only', async () => {
    const list = hosted([1, 2, 3, 4, 5]);
    const fn = mock();

    watch(list, ($) => {
      void $.get(1, 3);
      fn();
    });
    fn.mockClear();

    list.set(4, 99);
    await flush();

    expect(fn).not.toHaveBeenCalled();

    list.set(2, 99);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will subscribe out-of-range get to length so growth re-evaluates', async () => {
    const list = hosted([1]);
    const fn = mock();

    watch(list, ($) => {
      void $.get(5);
      fn();
    });
    fn.mockClear();

    list.push(2);
    await flush();

    expect(fn).toHaveBeenCalled();
  });
});

describe('pool', () => {
  class Item extends State {
    value = 0;
  }

  it('will create pool for class', () => {
    const pool = hosted(Item);

    expect(pool).toBeInstanceOf(has.Pool);
    expect(pool.size).toBe(0);
  });

  it('will create pool for factory', () => {
    const pool = hosted(() => ({ value: 0 }));

    expect(pool).toBeInstanceOf(has.Pool);
  });

  it('will construct mode as class identity', () => {
    const list = hosted<number>();
    const pool = hosted(Item);

    expect(list).toBeInstanceOf(has.List);
    expect(list).not.toBeInstanceOf(has.Pool);
    expect(pool).not.toBeInstanceOf(has.List);
  });

  it('will not define add on list', () => {
    const list = hosted<number>();

    expect(() => (list as any).add()).toThrow(TypeError);
  });

  it('will not define push on pool', () => {
    const pool = hosted(Item);

    expect(() => (pool as any).push(new Item())).toThrow(TypeError);
  });

  it('will return spawned value from add', () => {
    const pool = hosted(Item);
    const item = pool.add();

    expect(item).toBeInstanceOf(Item);
    expect(pool.has(item)).toBe(true);
    expect(pool.size).toBe(1);
  });

  it('will forward add arguments to class constructor', () => {
    const pool = hosted(Item);
    const item = pool.add({ value: 5 });

    expect(item.value).toBe(5);
  });

  it('will forward add arguments to factory', () => {
    const pool = hosted((n: number) => ({ n }));
    const item = pool.add(3);

    expect(item.n).toBe(3);
  });

  it('will pass through guest from factory', () => {
    const pool = hosted((value?: Item) => value || Item.new());
    const guest = Item.new();

    expect(pool.add(guest)).toBe(guest);
    expect(pool.has(guest)).toBe(true);
  });

  it('will ignore repeat add of same value', async () => {
    const pool = hosted((value?: Item) => value || Item.new());
    const guest = Item.new();
    const fn = mock();

    pool.add(guest);

    watch(pool, ($) => {
      void $.size;
      fn();
    });
    fn.mockClear();

    pool.add(guest);
    await flush();

    expect(fn).not.toHaveBeenCalled();
    expect(pool.size).toBe(1);
  });

  it('will remove plain values on delete', () => {
    const pool = hosted(() => ({}));
    const value = pool.add();

    expect(pool.delete(value)).toBe(true);
    expect(pool.delete(value)).toBe(false);
    expect(pool.size).toBe(0);
  });

  it('will destroy member on delete', () => {
    const pool = hosted(Item);
    const item = pool.add();

    expect(item.get(null)).toBe(false);

    pool.delete(item);

    expect(item.get(null)).toBe(true);
  });

  it('will destroy members on clear', () => {
    const pool = hosted(Item);
    const a = pool.add();
    const b = pool.add();

    pool.clear();

    expect(a.get(null)).toBe(true);
    expect(b.get(null)).toBe(true);
  });

  it('will not destroy guest on delete', () => {
    const pool = hosted((value?: Item) => value || Item.new());
    const guest = Item.new();

    pool.add(guest);
    pool.delete(guest);

    expect(guest.get(null)).toBe(false);
  });

  it('will own activated value made by factory', () => {
    const pool = hosted(() => Item.new());
    const item = pool.add();

    pool.delete(item);

    expect(item.get(null)).toBe(true);
  });

  it('will evict member when it dies', () => {
    const pool = hosted(Item);
    const item = pool.add();

    item.set(null);

    expect(pool.has(item)).toBe(false);
    expect(pool.size).toBe(0);
  });

  it('will not notify clear on empty pool', async () => {
    const pool = hosted(Item);
    const fn = mock();

    watch(pool, fn);
    fn.mockClear();

    pool.clear();
    await flush();

    expect(fn).not.toHaveBeenCalled();
  });
});

describe('pool adoption', () => {
  class Member extends State {
    owner = get(Owner);
  }

  class Owner extends State {
    members = has(Member);
  }

  it('will parent spawned member to owner', () => {
    const first = Owner.new();
    const second = Owner.new();

    expect(first.members.add().owner).toBe(first);
    expect(second.members.add().owner).toBe(second);
  });

  it('will destroy owned members with owner', () => {
    const owner = Owner.new();
    const a = owner.members.add();
    const b = owner.members.add();

    owner.set(null);

    expect(a.get(null)).toBe(true);
    expect(b.get(null)).toBe(true);
  });
});

describe('pool reads', () => {
  class Item extends State {
    value = 0;
  }

  it('will return snapshot array with no args', () => {
    const pool = hosted(Item);

    pool.add({ value: 1 });
    pool.add({ value: 2 });

    const snap = pool.get();

    expect(Array.isArray(snap)).toBe(true);
    expect(snap).toEqual([{ value: 1 }, { value: 2 }]);
  });

  it('will return first match for predicate', () => {
    const pool = hosted(Item);

    pool.add({ value: 1 });
    const two = pool.add({ value: 2 });

    expect(pool.get((item) => item.value > 1)).toBe(two);
  });

  it('will return undefined when predicate matches nothing', () => {
    const pool = hosted(Item);

    pool.add();

    expect(pool.get((item) => item.value > 99)).toBeUndefined();
  });

  it('will iterate members', () => {
    const pool = hosted((n: number) => ({ n }));
    const a = pool.add(1);
    const b = pool.add(2);

    expect([...pool]).toEqual([a, b]);
  });

  it('will map to plain array', () => {
    const pool = hosted((n: number) => ({ n }));

    pool.add(1);
    pool.add(2);

    expect(pool.map((v) => v.n * 2)).toEqual([2, 4]);
  });

  it('will skip map results matching ignore value', () => {
    const pool = hosted((n: number) => ({ n }));

    pool.add(1);
    pool.add(2);
    pool.add(3);

    expect(pool.map((v) => (v.n % 2 ? v.n : null), null)).toEqual([1, 3]);
  });

  it('will filter members', () => {
    const pool = hosted((n: number) => ({ n }));

    pool.add(1);
    pool.add(2);
    pool.add(3);

    expect(pool.filter((v) => v.n > 1).map((v) => v.n)).toEqual([2, 3]);
  });

  it('will support any and all', () => {
    const pool = hosted((n: number) => ({ n }));

    pool.add(2);
    pool.add(4);

    expect(pool.any((v) => v.n > 3)).toBe(true);
    expect(pool.any((v) => v.n > 9)).toBe(false);
    expect(pool.all((v) => v.n % 2 === 0)).toBe(true);
    expect(pool.all((v) => v.n > 2)).toBe(false);
  });
});

describe('pool subscriptions', () => {
  class Item extends State {
    value = 0;
  }

  it('will update on size when membership changes', async () => {
    const pool = hosted(Item);
    const fn = mock();

    watch(pool, ($) => {
      void $.size;
      fn();
    });
    fn.mockClear();

    const item = pool.add();
    await flush();

    expect(fn).toHaveBeenCalled();
    fn.mockClear();

    pool.delete(item);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update has(value) only for that value', async () => {
    const pool = hosted(Item);
    const item = pool.add();
    const fn = mock();

    watch(pool, ($) => {
      void $.has(item);
      fn();
    });
    fn.mockClear();

    pool.add();
    await flush();

    expect(fn).not.toHaveBeenCalled();

    pool.delete(item);
    await flush();

    expect(fn).toHaveBeenCalled();
  });

  it('will update iteration when membership changes', async () => {
    const pool = hosted(Item);
    const fn = mock();

    watch(pool, ($) => {
      for (const _ of $) void _;
      fn();
    });
    fn.mockClear();

    pool.add();
    await flush();

    expect(fn).toHaveBeenCalled();
  });
});
