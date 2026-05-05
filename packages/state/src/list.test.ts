import { vi, describe, it, expect } from '../vitest';
import { watch } from './observable';
import { List } from './list';

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('construction', () => {
  it('will create empty', () => {
    const list = new List<number>();
    expect(list.size).toBe(0);
    expect(list.get()).toEqual([]);
  });

  it('will accept array', () => {
    const list = new List([1, 2, 3]);
    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('will accept any iterable', () => {
    function* gen() {
      yield 'a';
      yield 'b';
    }
    expect(new List(gen()).get()).toEqual(['a', 'b']);
  });

  it('will copy from initial - mutating source does not leak', () => {
    const source = [1, 2, 3];
    const list = new List(source);
    source.push(4);
    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('will support List.from', () => {
    expect(List.from([1, 2]).get()).toEqual([1, 2]);
  });
});

describe('get', () => {
  it('will return snapshot with no args', () => {
    const list = new List([1, 2, 3]);
    const snap = list.get();
    expect(snap).toEqual([1, 2, 3]);
    snap.push(4);
    expect(list.size).toBe(3);
  });

  it('will unwrap nested .get() values in snapshot', () => {
    const inner = { get: () => 'unwrapped' };
    const list = new List([inner]);
    expect(list.get()).toEqual(['unwrapped']);
  });

  it('will read by positive index', () => {
    const list = new List(['a', 'b', 'c']);
    expect(list.get(1)).toBe('b');
  });

  it('will normalize negative index', () => {
    const list = new List(['a', 'b', 'c']);
    expect(list.get(-1)).toBe('c');
    expect(list.get(-3)).toBe('a');
  });

  it('will return undefined for out-of-range index', () => {
    const list = new List(['a', 'b']);
    expect(list.get(5)).toBeUndefined();
    expect(list.get(-5)).toBeUndefined();
  });

  it('will read range with start, end (end exclusive)', () => {
    const list = new List([10, 20, 30, 40]);
    expect(list.get(1, 3)).toEqual([20, 30]);
  });

  it('will normalize negative start in range', () => {
    const list = new List([10, 20, 30, 40]);
    expect(list.get(-2, 4)).toEqual([30, 40]);
  });

  it('will clamp end to length in range', () => {
    const list = new List([1, 2]);
    expect(list.get(0, 99)).toEqual([1, 2]);
  });

  it('will return first match for predicate', () => {
    const list = new List([1, 2, 3, 4]);
    expect(list.get((v) => v > 2)).toBe(3);
  });

  it('will return undefined when predicate matches nothing', () => {
    const list = new List([1, 2, 3]);
    expect(list.get((v) => v > 99)).toBeUndefined();
  });
});

describe('set', () => {
  it('will replace value at index', () => {
    const list = new List(['a', 'b', 'c']);
    list.set(1, 'B');
    expect(list.get()).toEqual(['a', 'B', 'c']);
  });

  it('will normalize negative index', () => {
    const list = new List(['a', 'b', 'c']);
    list.set(-1, 'C');
    expect(list.get()).toEqual(['a', 'b', 'C']);
  });

  it('will no-op for out-of-range positive', () => {
    const list = new List(['a']);
    list.set(5, 'x');
    expect(list.get()).toEqual(['a']);
  });

  it('will no-op for out-of-range negative', () => {
    const list = new List(['a']);
    list.set(-5, 'x');
    expect(list.get()).toEqual(['a']);
  });

  it('will no-op for unchanged value', () => {
    const list = new List(['a']);
    const fn = vi.fn();
    watch(list, fn);
    fn.mockClear();
    list.set(0, 'a');
    return flush().then(() => expect(fn).not.toBeCalled());
  });
});

describe('put', () => {
  it('will insert at index, shifting subsequent', () => {
    const list = new List([1, 2, 4]);
    list.put(2, 3);
    expect(list.get()).toEqual([1, 2, 3, 4]);
  });

  it('will insert multiple', () => {
    const list = new List([1, 4]);
    list.put(1, 2, 3);
    expect(list.get()).toEqual([1, 2, 3, 4]);
  });

  it('will append when index === length', () => {
    const list = new List([1, 2]);
    list.put(2, 3);
    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('will normalize negative index', () => {
    const list = new List([1, 4]);
    list.put(-1, 2, 3);
    expect(list.get()).toEqual([1, 2, 3, 4]);
  });

  it('will no-op when no items provided', () => {
    const list = new List([1, 2]);
    const fn = vi.fn();
    watch(list, fn);
    fn.mockClear();
    list.put(0);
    return flush().then(() => expect(fn).not.toBeCalled());
  });
});

describe('push', () => {
  it('will append and return new length', () => {
    const list = new List([1]);
    expect(list.push(2, 3)).toBe(3);
    expect(list.get()).toEqual([1, 2, 3]);
  });
});

describe('pop', () => {
  it('will remove from tail by default', () => {
    const list = new List([1, 2, 3]);
    expect(list.pop()).toBe(3);
    expect(list.get()).toEqual([1, 2]);
  });

  it('will remove at index', () => {
    const list = new List([1, 2, 3]);
    expect(list.pop(0)).toBe(1);
    expect(list.get()).toEqual([2, 3]);
  });

  it('will remove a count and return array', () => {
    const list = new List([1, 2, 3, 4]);
    expect(list.pop(1, 2)).toEqual([2, 3]);
    expect(list.get()).toEqual([1, 4]);
  });

  it('will normalize negative index', () => {
    const list = new List([1, 2, 3]);
    expect(list.pop(-2)).toBe(2);
    expect(list.get()).toEqual([1, 3]);
  });

  it('will return undefined on empty list', () => {
    const list = new List<number>();
    expect(list.pop()).toBeUndefined();
  });
});

describe('clear', () => {
  it('will remove all items', () => {
    const list = new List([1, 2, 3]);
    list.clear();
    expect(list.size).toBe(0);
  });

  it('will no-op on empty list', () => {
    const list = new List<number>();
    const fn = vi.fn();
    watch(list, fn);
    fn.mockClear();
    list.clear();
    return flush().then(() => expect(fn).not.toBeCalled());
  });
});

describe('iteration', () => {
  it('will iterate via for...of', () => {
    const out: number[] = [];
    for (const v of new List([1, 2, 3])) out.push(v);
    expect(out).toEqual([1, 2, 3]);
  });

  it('will spread', () => {
    expect([...new List(['a', 'b'])]).toEqual(['a', 'b']);
  });
});

describe('map', () => {
  it('will produce a plain array', () => {
    const list = new List([1, 2, 3]);
    const out = list.map((v) => v * 2);
    expect(out).toEqual([2, 4, 6]);
    expect(Array.isArray(out)).toBe(true);
  });

  it('will skip results matching ignore value', () => {
    const list = new List([1, 2, 3, 4]);
    const out = list.map((v) => (v % 2 ? v : null), null);
    expect(out).toEqual([1, 3]);
  });

  it('will receive index and list', () => {
    const list = new List(['a']);
    const fn = vi.fn((_v, _i, _l) => 0);
    list.map(fn);
    expect(fn).toBeCalledWith('a', 0, list);
  });
});

describe('filter', () => {
  it('will return matching items', () => {
    const list = new List([1, 2, 3, 4]);
    expect(list.filter((v) => v > 2)).toEqual([3, 4]);
  });
});

describe('any / all', () => {
  it('any returns true when match exists', () => {
    expect(new List([1, 2, 3]).any((v) => v > 2)).toBe(true);
  });

  it('any returns false when no match', () => {
    expect(new List([1, 2, 3]).any((v) => v > 99)).toBe(false);
  });

  it('any returns boolean independent of value truthiness', () => {
    const list = new List([1, 0, 2]);
    expect(list.any((v) => v === 0)).toBe(true);
  });

  it('all returns true when predicate true for every item', () => {
    expect(new List([2, 4, 6]).all((v) => v % 2 === 0)).toBe(true);
  });

  it('all returns false on first failure', () => {
    expect(new List([2, 3, 4]).all((v) => v % 2 === 0)).toBe(false);
  });

  it('all returns true on empty list', () => {
    expect(new List<number>().all((v) => v > 0)).toBe(true);
  });
});

describe('subscriptions', () => {
  it('will fire on size when length changes', async () => {
    const list = new List([1, 2]);
    const fn = vi.fn();
    watch(list, ($) => {
      void $.size;
      fn();
    });
    fn.mockClear();
    list.push(3);
    await flush();
    expect(fn).toHaveBeenCalled();
  });

  it('will fire on get(i) only when that index changes', async () => {
    const list = new List(['a', 'b', 'c']);
    const fn = vi.fn();
    watch(list, ($) => {
      void $.get(1);
      fn();
    });
    fn.mockClear();

    list.set(0, 'A');
    await flush();
    expect(fn).not.toBeCalled();

    list.set(1, 'B');
    await flush();
    expect(fn).toHaveBeenCalled();
  });

  it('will fire on iteration when any index changes', async () => {
    const list = new List([1, 2, 3]);
    const fn = vi.fn();
    watch(list, ($) => {
      for (const _ of $) void _;
      fn();
    });
    fn.mockClear();

    list.set(1, 99);
    await flush();
    expect(fn).toHaveBeenCalled();
  });

  it('will fire on iteration when length grows (append)', async () => {
    const list = new List([1, 2]);
    const fn = vi.fn();
    watch(list, ($) => {
      for (const _ of $) void _;
      fn();
    });
    fn.mockClear();

    list.push(3);
    await flush();
    expect(fn).toHaveBeenCalled();
  });

  it('any() with no match wakes on append (LENGTH dep)', async () => {
    const list = new List([1, 2, 3]);
    const fn = vi.fn();
    watch(list, ($) => {
      void $.any((v) => v > 99);
      fn();
    });
    fn.mockClear();

    list.push(100);
    await flush();
    expect(fn).toHaveBeenCalled();
  });

  it('all() wakes when an appended item violates the predicate', async () => {
    const list = new List([2, 4]);
    const fn = vi.fn();
    watch(list, ($) => {
      void $.all((v) => v % 2 === 0);
      fn();
    });
    fn.mockClear();

    list.push(3);
    await flush();
    expect(fn).toHaveBeenCalled();
  });

  it('get(predicate) wakes when an earlier item becomes a candidate', async () => {
    const list = new List([1, 2, 3]);
    const fn = vi.fn();
    watch(list, ($) => {
      void $.get((v) => v > 2);
      fn();
    });
    fn.mockClear();

    list.set(0, 99);
    await flush();
    expect(fn).toHaveBeenCalled();
  });

  it('get(start, end) subscribes to indices in range only', async () => {
    const list = new List([1, 2, 3, 4, 5]);
    const fn = vi.fn();
    watch(list, ($) => {
      void $.get(1, 3);
      fn();
    });
    fn.mockClear();

    list.set(4, 99);
    await flush();
    expect(fn).not.toBeCalled();

    list.set(2, 99);
    await flush();
    expect(fn).toHaveBeenCalled();
  });

  it('get out-of-range subscribes to LENGTH so growth re-evaluates', async () => {
    const list = new List([1]);
    const fn = vi.fn();
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
