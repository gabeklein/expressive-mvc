import { vi, describe, it, expect } from 'vitest';
import { State } from '../state';
import { fires } from '../../test.setup';
import { get } from './get';
import { has } from './has';

function reactive<T>(initial?: Iterable<T> | false | null): has.List<T>;

function reactive<T extends State>(
  Type: new (...args: State.Args<T>) => T
): has.Create<T>;

function reactive<T extends State, K extends State.Field<T>>(
  Type: new (...args: State.Args<T>) => T,
  fromKey: K
): has.From<T, K>;

function reactive<R, A extends unknown[]>(
  make: (...args: A) => R
): has.Pool<Exclude<R, null | undefined>, A, R>;

function reactive(...args: any[]): any {
  const arg = args[0];

  return typeof arg == 'function'
    ? new has.Pool(arg, args[1])
    : new has.List(arg);
}

describe('factory', () => {
  it('will accept any iterable or falsy initial', () => {
    function* gen() {
      yield 'a';
      yield 'b';
    }

    expect(reactive<number>()).toBeInstanceOf(has.List);
    expect(reactive<number>().get()).toEqual([]);
    expect(reactive<number>(null).size).toBe(0);
    expect(reactive<number>(false).size).toBe(0);
    expect(reactive([1, 2, 3]).get()).toEqual([1, 2, 3]);
    expect(reactive(gen()).get()).toEqual(['a', 'b']);
  });

  it('will copy from initial', () => {
    const source = [1, 2, 3];
    const list = reactive(source);

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
    const list = reactive([1, 2, 3]);
    const snap = list.get();

    expect(snap).toEqual([1, 2, 3]);

    snap.push(4);

    expect(list.size).toBe(3);
  });

  it('will unwrap nested get values in snapshot', () => {
    const inner = { get: () => 'unwrapped' };
    const list = reactive([inner]);

    expect(list.get()).toEqual(['unwrapped']);
  });

  it.each<[string, (list: has.List<number>) => unknown, unknown]>([
    ['will read by positive index', (list) => list.get(1), 20],
    ['will normalize negative index', (list) => list.get(-1), 40],
    ['will normalize negative index to start', (list) => list.get(-4), 10],
    ['will return undefined for out-of-range index', (list) => list.get(5), undefined],
    ['will return undefined for out-of-range negative index', (list) => list.get(-5), undefined],
    ['will read range with start, end', (list) => list.get(1, 3), [20, 30]],
    ['will normalize negative start in range', (list) => list.get(-2, 4), [30, 40]],
    ['will clamp end to length in range', (list) => list.get(0, 99), [10, 20, 30, 40]]
  ])('%s', (_, read, expected) => {
    expect(read(reactive([10, 20, 30, 40]))).toEqual(expected);
  });
});

describe('write', () => {
  it.each<[string, (list: has.List<number>) => unknown, number[]]>([
    ['will set value at index', (list) => list.set(1, 9), [1, 9, 4]],
    ['will set at negative index', (list) => list.set(-1, 9), [1, 2, 9]],
    ['will not set out-of-range positive', (list) => list.set(5, 9), [1, 2, 4]],
    ['will not set out-of-range negative', (list) => list.set(-5, 9), [1, 2, 4]],
    ['will put at index, shifting subsequent', (list) => list.put(2, 3), [1, 2, 3, 4]],
    ['will put multiple', (list) => list.put(1, 7, 8), [1, 7, 8, 2, 4]],
    ['will put at negative index', (list) => list.put(-1, 3), [1, 2, 3, 4]],
    ['will put appending when index equals length', (list) => list.put(3, 5), [1, 2, 4, 5]],
    ['will push and return new length', (list) => expect(list.push(5, 6)).toBe(5), [1, 2, 4, 5, 6]],
    ['will pop from tail by default', (list) => expect(list.pop()).toBe(4), [1, 2]],
    ['will pop at index', (list) => expect(list.pop(0)).toBe(1), [2, 4]],
    ['will pop a count and return array', (list) => expect(list.pop(0, 2)).toEqual([1, 2]), [4]],
    ['will pop at negative index', (list) => expect(list.pop(-2)).toBe(2), [1, 4]],
    ['will clear all items', (list) => list.clear(), []]
  ])('%s', (_, act, expected) => {
    const list = reactive([1, 2, 4]);

    act(list);

    expect(list.get()).toEqual(expected);
  });

  it('will pop undefined on empty list', () => {
    expect(reactive<number>().pop()).toBeUndefined();
  });
});

describe('reads', () => {
  it('will iterate and spread', () => {
    const out: number[] = [];

    for (const v of reactive([1, 2, 3])) out.push(v);

    expect(out).toEqual([1, 2, 3]);
    expect([...reactive(['a', 'b'])]).toEqual(['a', 'b']);
  });

  it('will map with index and list into a plain array', () => {
    const list = reactive(['a', 'b']);
    const fn = vi.fn((v: string, i: number, _l: unknown) => v + i);
    const out = list.map(fn);

    expect(out).toEqual(['a0', 'b1']);
    expect(Array.isArray(out)).toBe(true);
    expect(fn).toHaveBeenCalledWith('a', 0, list);
  });
});

type N = { n: number };

describe.each<[string, (...n: number[]) => has.Pool<N>]>([
  ['List', (...n) => reactive(n.map((n) => ({ n }))) as unknown as has.Pool<N>],
  ['Pool', (...n) => {
    const pool = reactive((n: number) => ({ n }));
    n.forEach((n) => pool.add(n));
    return pool;
  }]
])('%s reads', (_, make) => {
  it('will return first match for predicate', () => {
    const list = make(1, 2, 3, 4);

    expect(list.get((v) => v.n > 2)).toBe([...list][2]);
    expect(list.get((v) => v.n > 99)).toBeUndefined();
  });

  it('will iterate members', () => {
    expect([...make(1, 2)]).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('will map, skipping results matching ignore value', () => {
    const list = make(1, 2, 3, 4);

    expect(list.map((v) => v.n * 2)).toEqual([2, 4, 6, 8]);
    expect(list.map((v) => (v.n % 2 ? v.n : null), null)).toEqual([1, 3]);
  });

  it('will filter members', () => {
    expect(make(1, 2, 3, 4).filter((v) => v.n > 2)).toEqual([{ n: 3 }, { n: 4 }]);
  });

  it('will support any and all', () => {
    const list = make(2, 0, 4);

    expect(list.any((v) => v.n > 3)).toBe(true);
    expect(list.any((v) => v.n > 9)).toBe(false);
    expect(list.any((v) => v.n === 0)).toBe(true);
    expect(list.all((v) => v.n % 2 === 0)).toBe(true);
    expect(list.all((v) => v.n > 2)).toBe(false);
    expect(make().all((v) => v.n > 0)).toBe(true);
  });
});

describe('subscriptions', () => {
  type List = has.List<number>;

  it.each<[string, number[], ($: List) => unknown, (list: List) => unknown, number]>([
    ['will update on size when length changes', [1, 2], ($) => $.size, (list) => list.push(3), 1],
    ['will not update get(i) when another index changes', [1, 2, 3], ($) => $.get(1), (list) => list.set(0, 9), 0],
    ['will update get(i) when that index changes', [1, 2, 3], ($) => $.get(1), (list) => list.set(1, 9), 1],
    ['will update on iteration when any index changes', [1, 2, 3], ($) => [...$], (list) => list.set(1, 99), 1],
    ['will update on iteration when length grows', [1, 2], ($) => [...$], (list) => list.push(3), 1],
    ['will update any() with no match on append', [1, 2, 3], ($) => $.any((v) => v > 99), (list) => list.push(100), 1],
    ['will update all() when appended item violates predicate', [2, 4], ($) => $.all((v) => v % 2 === 0), (list) => list.push(3), 1],
    ['will update get(predicate) when earlier item becomes candidate', [1, 2, 3], ($) => $.get((v) => v > 2), (list) => list.set(0, 99), 1],
    ['will not update get(start, end) outside range', [1, 2, 3, 4, 5], ($) => $.get(1, 3), (list) => list.set(4, 99), 0],
    ['will update get(start, end) inside range', [1, 2, 3, 4, 5], ($) => $.get(1, 3), (list) => list.set(2, 99), 1],
    ['will update out-of-range get on growth', [1], ($) => $.get(5), (list) => list.push(2), 1],
    ['will not notify set of unchanged value', [1], ($) => [...$], (list) => list.set(0, 1), 0],
    ['will not notify put of no items', [1, 2], ($) => [...$], (list) => list.put(0), 0],
    ['will not notify clear of empty list', [], ($) => $.size, (list) => list.clear(), 0]
  ])('%s', async (_, initial, read, act, runs) => {
    expect(await fires(reactive(initial), read, act)).toBe(runs);
  });
});

describe('pool', () => {
  class Item extends State {
    value = 0;
  }

  it('will create pool for class or factory', () => {
    const pool = reactive(Item);

    expect(pool).toBeInstanceOf(has.Pool);
    expect(pool).not.toBeInstanceOf(has.List);
    expect(reactive<number>()).not.toBeInstanceOf(has.Pool);
    expect(reactive(() => ({ value: 0 }))).toBeInstanceOf(has.Pool);
    expect(pool.size).toBe(0);
  });

  it('will create pool for class without keys', () => {
    const pool = new has.Pool<Item>(Item);
    const item = pool.add({ value: 3 });

    expect(item.value).toBe(3);
    expect(pool.size).toBe(1);
  });

  it.each([
    ['will not define add on list', () => (reactive<number>() as any).add()],
    ['will not define push on pool', () => (reactive(Item) as any).push(new Item())]
  ])('%s', (_, call) => {
    expect(call).toThrow(TypeError);
  });

  it('will return spawned value from add', () => {
    const pool = reactive(Item);
    const item = pool.add();

    expect(item).toBeInstanceOf(Item);
    expect(pool.has(item)).toBe(true);
    expect(pool.size).toBe(1);
  });

  it('will forward add arguments to factory', () => {
    expect(reactive((n: number) => ({ n })).add(3).n).toBe(3);
  });

  it('will not add if factory returns nothing', () => {
    const pool = reactive((n: number) => (n > 0 ? { n } : undefined));

    expect(pool.add(1)).toEqual({ n: 1 });
    expect(pool.add(0)).toBeUndefined();
    expect(pool.size).toBe(1);
  });

  it('will pass through guest from factory', () => {
    const pool = reactive((value?: Item) => value || Item.new());
    const guest = Item.new();

    expect(pool.add(guest)).toBe(guest);
    expect(pool.has(guest)).toBe(true);
  });

  it.each([
    ['will admit instance of class instead of constructing', () => Item.new()],
    ['will admit subclass instance', () => (class Special extends Item {}).new()]
  ])('%s', (_, create) => {
    const pool = reactive(Item);
    const guest = create();

    expect(pool.add(guest)).toBe(guest);
    expect(pool.has(guest)).toBe(true);
    expect(pool.size).toBe(1);
  });

  it('will construct from props objects', () => {
    const pool = reactive(Item);
    const item = pool.add({ value: 5 });

    expect(item).toBeInstanceOf(Item);
    expect(item.value).toBe(5);
    expect(pool.add({ value: 1 }, { value: 2 }).value).toBe(2);
  });

  it('will own admitted instance which is fresh but not one active', () => {
    const pool = reactive(Item);
    const fresh = new Item();
    const active = Item.new();

    pool.add(fresh);
    pool.add(active);
    pool.delete(fresh);

    expect(pool.delete(active)).toBe(true);
    expect(fresh.get(null)).toBe(true);
    expect(active.get(null)).toBe(false);
  });

  it('will not admit instance in factory mode', () => {
    const pool = reactive((value: Item) => new Item({ value: value.value + 1 }));
    const seed = Item.new({ value: 1 });
    const made = pool.add(seed);

    expect(made).not.toBe(seed);
    expect(made.value).toBe(2);
  });

  it('will ignore repeat add of same value', async () => {
    const pool = reactive((value?: Item) => value || Item.new());
    const guest = Item.new();

    pool.add(guest);

    expect(await fires(pool, ($) => $.size, () => pool.add(guest))).toBe(0);
    expect(pool.size).toBe(1);
  });

  it('will remove plain values on delete', () => {
    const pool = reactive(() => ({}));
    const value = pool.add();

    expect(pool.delete(value)).toBe(true);
    expect(pool.delete(value)).toBe(false);
    expect(pool.size).toBe(0);
  });

  it('will destroy members on delete and clear', () => {
    const pool = reactive(Item);
    const [a, b, c] = [pool.add(), pool.add(), pool.add()];

    pool.delete(a);

    expect(a.get(null)).toBe(true);
    expect(b.get(null)).toBe(false);

    pool.clear();

    expect(b.get(null)).toBe(true);
    expect(c.get(null)).toBe(true);
  });

  it('will own fresh value made by factory but not a guest', () => {
    const pool = reactive((value?: Item) => value || new Item());
    const guest = Item.new();
    const made = pool.add();

    pool.add(guest);
    pool.delete(guest);
    pool.delete(made);

    expect(guest.get(null)).toBe(false);
    expect(made.get(null)).toBe(true);
  });

  it('will evict member when it dies', () => {
    const pool = reactive(Item);
    const item = pool.add();

    item.set(null);

    expect(pool.has(item)).toBe(false);
    expect(pool.size).toBe(0);
  });

  it('will not notify clear on empty pool', async () => {
    const pool = reactive(Item);

    expect(await fires(pool, ($) => $.size, () => pool.clear())).toBe(0);
  });
});

describe('pool lookup', () => {
  class Item extends State {
    id = '';
  }

  const known = new Map([['abc', Item.new({ id: 'abc' })]]);

  it('will adopt instance returned by factory', () => {
    const pool = reactive((id: string) => known.get(id) || new Item({ id }));

    expect(pool.add('abc')).toBe(known.get('abc'));
    expect(pool.add('xyz')).not.toBe(known.get('abc'));
    expect(pool.size).toBe(2);
  });

  it('will not add member returned twice', async () => {
    const pool = reactive((id: string) => known.get(id));

    pool.add('abc');

    expect(await fires(pool, ($) => $.size, () => expect(pool.add('abc')).toBe(known.get('abc')))).toBe(0);
    expect(pool.size).toBe(1);
  });

  it.each([
    ['will not add if factory declines', undefined],
    ['will not add if factory returns null', null]
  ])('%s', async (_, none) => {
    const pool = reactive((id: string) => known.get(id) || none);

    expect(await fires(pool, ($) => $.size, () => expect(pool.add('nope')).toBe(none))).toBe(0);
    expect(pool.size).toBe(0);
  });

  it('will exclude nullish from member type', () => {
    const pool = reactive((id: string) => known.get(id) || null);

    pool.add('abc');

    expect(pool.map((item) => item.id)).toEqual(['abc']);
  });
});

describe('pool key', () => {
  class Cell extends State {
    at = '';
    color = 'white';
  }

  it('will assign argument to named property', () => {
    const pool = reactive(Cell, 'at');
    const cell = pool.add('a1');

    expect(cell.at).toBe('a1');
    expect(cell.color).toBe('white');
  });

  it('will still admit instance of class', () => {
    const pool = reactive(Cell, 'at');
    const guest = Cell.new({ at: 'b2' });

    expect(pool.add(guest)).toBe(guest);
    expect(pool.size).toBe(1);
  });

  it('will own member spawned through key, typed as has.From', () => {
    class Member extends State {
      id = '';
      owner = get(Owner);
    }

    class Owner extends State {
      members = has(Member, 'id');
    }

    const owner = Owner.new();
    const members: has.From<Member, 'id'> = owner.members;
    const member = members.add('abc');

    expect(member.owner).toBe(owner);
    expect(member.id).toBe('abc');
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

  it('will not destroy guest with owner', () => {
    class Guest extends State {}

    class Host extends State {
      members = has((value?: Guest) => value || new Guest());
    }

    const host = Host.new();
    const guest = Guest.new();

    host.members.add(guest);
    host.set(null);

    expect(guest.get(null)).toBe(false);
  });

  it('will hold a member of one pool in another', () => {
    class Thing extends State {}

    class Store extends State {
      items = has(Thing);
      selected = has(Thing);
    }

    const store = Store.new();
    const item = store.items.add();

    expect(store.selected.add(item)).toBe(item);

    store.selected.delete(item);

    expect(item.get(null)).toBe(false);
    expect(store.items.has(item)).toBe(true);

    item.set(null);

    expect(store.items.has(item)).toBe(false);
  });

  it('will own instances injected into pool', () => {
    class Thing extends State {}

    class Store extends State {
      items = has(Thing);
    }

    const store = Store.new();
    const injected = new Thing();

    store.items.add(injected);
    store.set(null);

    expect(injected.get(null)).toBe(true);
  });
});

describe('pool snapshot', () => {
  it('will return snapshot array with no args', () => {
    class Item extends State {
      value = 0;
    }

    const pool = reactive(Item);

    pool.add({ value: 1 });
    pool.add({ value: 2 });

    const snap = pool.get();

    expect(Array.isArray(snap)).toBe(true);
    expect(snap).toEqual([{ value: 1 }, { value: 2 }]);
  });
});

describe('pool subscriptions', () => {
  class Item extends State {
    value = 0;
  }

  it('will update on size when membership changes', async () => {
    const pool = reactive(Item);
    const item = pool.add();

    expect(await fires(pool, ($) => $.size, () => pool.add())).toBe(1);
    expect(await fires(pool, ($) => $.size, () => pool.delete(item))).toBe(1);
  });

  it('will update has(value) only for that value', async () => {
    const pool = reactive(Item);
    const item = pool.add();

    expect(await fires(pool, ($) => $.has(item), () => pool.add())).toBe(0);
    expect(await fires(pool, ($) => $.has(item), () => pool.delete(item))).toBe(1);
  });

  it('will update iteration when membership changes', async () => {
    const pool = reactive(Item);

    expect(await fires(pool, ($) => [...$], () => pool.add())).toBe(1);
  });
});
