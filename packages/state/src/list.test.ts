import { describe, expect, it, vi } from '../vitest';
import { List } from './list';
import { watch } from './observable';

describe('construction', () => {
  it('creates empty list', () => {
    const list = new List<number>();
    expect(list.size).toBe(0);
    expect(list.get()).toEqual([]);
  });

  it('accepts iterable', () => {
    const list = new List([1, 2, 3]);
    expect(list.size).toBe(3);
    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('accepts generator iterable', () => {
    function* gen() {
      yield 'a';
      yield 'b';
    }
    const list = new List(gen());
    expect(list.get()).toEqual(['a', 'b']);
  });

  it('static from creates list from iterable', () => {
    const list = List.from(new Set([1, 2, 3]));
    expect(list.get()).toEqual([1, 2, 3]);
  });
});

describe('get', () => {
  it('returns full snapshot with no args', () => {
    const list = new List([1, 2, 3]);
    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('returns item at index', () => {
    const list = new List(['a', 'b', 'c']);
    expect(list.get(0)).toBe('a');
    expect(list.get(2)).toBe('c');
  });

  it('returns undefined for out-of-range index', () => {
    const list = new List([1, 2]);
    expect(list.get(5)).toBeUndefined();
  });

  it('returns range slice', () => {
    const list = new List([10, 20, 30, 40, 50]);
    expect(list.get(1, 4)).toEqual([20, 30, 40]);
  });

  it('range clamps to length', () => {
    const list = new List([1, 2, 3]);
    expect(list.get(0, 100)).toEqual([1, 2, 3]);
  });

  it('finds first match by predicate', () => {
    const list = new List([1, 2, 3, 4]);
    expect(list.get((v) => v > 2)).toBe(3);
  });

  it('returns undefined when predicate matches nothing', () => {
    const list = new List([1, 2, 3]);
    expect(list.get((v) => v > 10)).toBeUndefined();
  });

  it('finds all matches when second arg is true', () => {
    const list = new List([1, 2, 3, 4]);
    expect(list.get((v) => v % 2 === 0, true)).toEqual([2, 4]);
  });

  it('snapshot recursively unwraps items implementing get()', () => {
    const inner = new List([1, 2]);
    const outer = new List([inner]);
    expect(outer.get()).toEqual([[1, 2]]);
  });
});

describe('set', () => {
  it('replaces item at index', () => {
    const list = new List(['a', 'b', 'c']);
    list.set(1, 'B');
    expect(list.get()).toEqual(['a', 'B', 'c']);
  });

  it('extends list when index >= length', () => {
    const list = new List([1, 2]);
    list.set(3, 99);
    expect(list.get(3)).toBe(99);
    expect(list.size).toBe(4);
  });

  it('skips no-op when value is reference-equal', () => {
    const list = new List([1, 2, 3]);
    const fn = vi.fn();
    watch(list, ($) => {
      $.get(1);
      fn();
    });
    expect(fn).toBeCalledTimes(1);
    list.set(1, 2);
    return new Promise((r) => setTimeout(r, 5)).then(() => {
      expect(fn).toBeCalledTimes(1);
    });
  });
});

describe('put', () => {
  it('inserts at given index', () => {
    const list = new List([1, 2, 4]);
    list.put(2, 3);
    expect(list.get()).toEqual([1, 2, 3, 4]);
  });

  it('inserts multiple items', () => {
    const list = new List(['a', 'd']);
    list.put(1, 'b', 'c');
    expect(list.get()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('inserts at front with index 0', () => {
    const list = new List([2, 3]);
    list.put(0, 1);
    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('clamps positive index to length', () => {
    const list = new List([1, 2]);
    list.put(99, 3);
    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('supports negative index relative to end', () => {
    const list = new List([1, 2, 4]);
    list.put(-1, 3);
    expect(list.get()).toEqual([1, 2, 3, 4]);
  });

  it('clamps negative index past start to 0', () => {
    const list = new List([2, 3]);
    list.put(-99, 1);
    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('no-op with no items', () => {
    const list = new List([1, 2]);
    list.put(0);
    expect(list.get()).toEqual([1, 2]);
  });
});

describe('pop', () => {
  it('removes and returns last item by default', () => {
    const list = new List([1, 2, 3]);
    expect(list.pop()).toBe(3);
    expect(list.get()).toEqual([1, 2]);
  });

  it('returns undefined on empty list', () => {
    const list = new List<number>();
    expect(list.pop()).toBeUndefined();
  });

  it('removes at specified index', () => {
    const list = new List(['a', 'b', 'c']);
    expect(list.pop(0)).toBe('a');
    expect(list.get()).toEqual(['b', 'c']);
  });

  it('returns single item with arity 1', () => {
    const list = new List([1, 2, 3]);
    const result = list.pop(1);
    expect(result).toBe(2);
    expect(typeof result).not.toBe('object');
  });

  it('returns array with count specified', () => {
    const list = new List([1, 2, 3, 4, 5]);
    const result = list.pop(1, 3);
    expect(result).toEqual([2, 3, 4]);
    expect(list.get()).toEqual([1, 5]);
  });

  it('count of 0 returns empty array, no mutation', () => {
    const list = new List([1, 2, 3]);
    expect(list.pop(0, 0)).toEqual([]);
    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('supports negative index', () => {
    const list = new List([1, 2, 3]);
    expect(list.pop(-1)).toBe(3);
    expect(list.get()).toEqual([1, 2]);
  });
});

describe('push', () => {
  it('appends single item, returns new length', () => {
    const list = new List([1, 2]);
    expect(list.push(3)).toBe(3);
    expect(list.get()).toEqual([1, 2, 3]);
  });

  it('appends multiple items', () => {
    const list = new List([1]);
    list.push(2, 3, 4);
    expect(list.get()).toEqual([1, 2, 3, 4]);
  });
});

describe('clear', () => {
  it('removes all items', () => {
    const list = new List([1, 2, 3]);
    list.clear();
    expect(list.size).toBe(0);
    expect(list.get()).toEqual([]);
  });

  it('no-op on empty list', () => {
    const list = new List<number>();
    list.clear();
    expect(list.get()).toEqual([]);
  });
});

describe('iteration', () => {
  it('iterates with for-of', () => {
    const list = new List([1, 2, 3]);
    const collected: number[] = [];
    for (const v of list) collected.push(v);
    expect(collected).toEqual([1, 2, 3]);
  });

  it('spreads to plain array', () => {
    const list = new List(['a', 'b']);
    expect([...list]).toEqual(['a', 'b']);
  });
});

describe('map', () => {
  it('transforms each item', () => {
    const list = new List([1, 2, 3]);
    expect(list.map((v) => v * 2)).toEqual([2, 4, 6]);
  });

  it('passes index and list to mapper', () => {
    const list = new List(['a', 'b']);
    const out = list.map((v, i, l) => ({ v, i, size: l.size }));
    expect(out).toEqual([
      { v: 'a', i: 0, size: 2 },
      { v: 'b', i: 1, size: 2 }
    ]);
  });

  it('drops items matching ignore value', () => {
    const list = new List([1, 2, 3, 4]);
    const out = list.map((v) => (v % 2 ? v : null), null);
    expect(out).toEqual([1, 3]);
  });

  it('treats explicit undefined ignore as filter target', () => {
    const list = new List([1, 2, 3]);
    const out = list.map<number | undefined, undefined>(
      (v) => (v === 2 ? undefined : v),
      undefined
    );
    expect(out).toEqual([1, 3]);
  });
});

describe('filter', () => {
  it('keeps items where predicate is true', () => {
    const list = new List([1, 2, 3, 4, 5]);
    expect(list.filter((v) => v > 2)).toEqual([3, 4, 5]);
  });

  it('returns empty array when nothing matches', () => {
    const list = new List([1, 2, 3]);
    expect(list.filter(() => false)).toEqual([]);
  });
});

describe('all', () => {
  it('returns true when every item passes', () => {
    const list = new List([2, 4, 6]);
    expect(list.all((v) => v % 2 === 0)).toBe(true);
  });

  it('returns false when any item fails', () => {
    const list = new List([2, 3, 4]);
    expect(list.all((v) => v % 2 === 0)).toBe(false);
  });

  it('returns true on empty list (vacuous truth)', () => {
    const list = new List<number>();
    expect(list.all(() => false)).toBe(true);
  });
});

describe('subscription', () => {
  it('fires watcher when item changes', async () => {
    const list = new List([1, 2, 3]);
    const fn = vi.fn();

    watch(list, ($) => {
      $.get(1);
      fn();
    });

    expect(fn).toBeCalledTimes(1);
    list.set(1, 99);
    await new Promise((r) => setTimeout(r, 5));
    expect(fn).toBeCalledTimes(2);
  });

  it('fires watcher on size change after push', async () => {
    const list = new List([1, 2]);
    const fn = vi.fn();

    watch(list, ($) => {
      $.size;
      fn();
    });

    expect(fn).toBeCalledTimes(1);
    list.push(3);
    await new Promise((r) => setTimeout(r, 5));
    expect(fn).toBeCalledTimes(2);
  });

  it('fires watcher when iterating items change', async () => {
    const list = new List([1, 2, 3]);
    const fn = vi.fn();

    watch(list, ($) => {
      for (const _ of $) {
        // iterate
      }
      fn();
    });

    expect(fn).toBeCalledTimes(1);
    list.set(0, 99);
    await new Promise((r) => setTimeout(r, 5));
    expect(fn).toBeCalledTimes(2);
  });

  it('does not fire when read index is unchanged', async () => {
    const list = new List([1, 2, 3]);
    const fn = vi.fn();

    watch(list, ($) => {
      $.get(0);
      fn();
    });

    expect(fn).toBeCalledTimes(1);
    list.set(2, 99);
    await new Promise((r) => setTimeout(r, 5));
    expect(fn).toBeCalledTimes(1);
  });

  it('dispatches when mutated via proxy inside watch', async () => {
    const list = new List([1, 2, 3]);
    const outer = vi.fn();

    let proxy!: List<number>;
    watch(list, ($) => {
      proxy = $;
      $.size;
      outer();
    });

    expect(outer).toBeCalledTimes(1);
    proxy.push(4);
    await new Promise((r) => setTimeout(r, 5));
    expect(outer).toBeCalledTimes(2);
    expect(list.get()).toEqual([1, 2, 3, 4]);
  });
});

describe('all - smart memoization', () => {
  it('does not fire watcher when adding non-affecting item', async () => {
    const list = new List([2, 4, 6]);
    const isEven = (v: number) => v % 2 === 0;
    const fn = vi.fn();

    watch(list, ($) => {
      $.all(isEven);
      fn();
    });

    expect(fn).toBeCalledTimes(1);
    list.push(8);
    await new Promise((r) => setTimeout(r, 5));
    expect(fn).toBeCalledTimes(1);
  });

  it('fires watcher when added item flips result', async () => {
    const list = new List([2, 4, 6]);
    const isEven = (v: number) => v % 2 === 0;
    const fn = vi.fn();

    watch(list, ($) => {
      $.all(isEven);
      fn();
    });

    expect(fn).toBeCalledTimes(1);
    list.push(7);
    await new Promise((r) => setTimeout(r, 5));
    expect(fn).toBeCalledTimes(2);
  });

  it('does not fire when changing item that already failed', async () => {
    const list = new List([2, 3, 4]);
    const isEven = (v: number) => v % 2 === 0;
    const fn = vi.fn();

    watch(list, ($) => {
      $.all(isEven);
      fn();
    });

    expect(fn).toBeCalledTimes(1);
    list.set(1, 5);
    await new Promise((r) => setTimeout(r, 5));
    expect(fn).toBeCalledTimes(1);
  });

  it('fires when only-failing item is fixed', async () => {
    const list = new List([2, 3, 4]);
    const isEven = (v: number) => v % 2 === 0;
    const fn = vi.fn();

    watch(list, ($) => {
      $.all(isEven);
      fn();
    });

    expect(fn).toBeCalledTimes(1);
    list.set(1, 6);
    await new Promise((r) => setTimeout(r, 5));
    expect(fn).toBeCalledTimes(2);
  });

  it('handles removal of the only failing item', async () => {
    const list = new List([2, 3, 4]);
    const isEven = (v: number) => v % 2 === 0;

    expect(list.all(isEven)).toBe(false);

    list.pop(1);
    expect(list.all(isEven)).toBe(true);
  });
});
