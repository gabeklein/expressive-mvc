import { mock, describe, it, expect } from 'bun:test';
import { observer, watch } from '../observable';
import { State } from '../state';
import { hot } from './hot';
import { flushMicrotasks as flush } from '../../test.setup';

describe('factory', () => {
  it('wraps an array', () => {
    const arr = hot([1, 2, 3]);
    expect(Array.from(arr)).toEqual([1, 2, 3]);
    expect(arr.length).toBe(3);
  });

  it('throws on sparse array input', () => {
    expect(() => hot(Array(3))).toThrow('hot() arrays must be dense');
    expect(() => hot([1, , 3] as number[])).toThrow(
      'hot() arrays must be dense'
    );
  });

  it('wraps a plain object', () => {
    const obj = hot({ a: 1, b: 2 });
    expect(obj.a).toBe(1);
    expect(obj.b).toBe(2);
  });

  it('shares storage with input', () => {
    const source = [1, 2, 3];
    const arr = hot(source);
    arr.push(4);
    expect(source).toEqual([1, 2, 3, 4]);
  });

  it('does not override a user get property', () => {
    const obj = hot({ get: 'value' });

    expect(obj.get).toBe('value');
  });

  it('throws on non-object input', () => {
    // @ts-ignore
    expect(() => hot('str')).toThrow();
    // @ts-ignore
    expect(() => hot(42)).toThrow();
    // @ts-ignore
    expect(() => hot(null)).toThrow();
  });

  it('makes the proxy observable and ready', () => {
    const arr = hot([] as number[]);
    const o = observer(arr);
    expect(o).toBeDefined();
    expect(o!.ready).toBe(true);
  });
});

describe('array', () => {
  it('fires on indexed write subscribers track', async () => {
    const arr = hot([1, 2, 3]);
    const cb = mock();
    watch(arr, ($) => {
      void $[1];
      cb();
    });
    cb.mockClear();

    arr[1] = 99;
    await flush();
    expect(cb).toHaveBeenCalled();
  });

  it('does not fire when an unrelated index changes', async () => {
    const arr = hot([1, 2, 3]);
    const cb = mock();
    watch(arr, ($) => {
      void $[0];
      cb();
    });
    cb.mockClear();

    arr[2] = 99;
    await flush();
    expect(cb).not.toBeCalled();
  });

  it('does not fire when value is unchanged', async () => {
    const arr = hot([1, 2, 3]);
    const cb = mock();
    watch(arr, ($) => {
      void $[0];
      cb();
    });
    cb.mockClear();

    arr[0] = 1;
    await flush();
    expect(cb).not.toBeCalled();
  });

  it('does not fire keyed events for symbol writes', async () => {
    const key = Symbol('key');
    const arr = hot([1, 2, 3] as (number[] & { [key]?: number }));
    const cb = mock();
    watch(arr, ($) => {
      void $[0];
      cb();
    });
    cb.mockClear();

    (arr as any)[key] = 4;
    await flush();
    expect(cb).not.toBeCalled();
  });

  it('fires on length when push grows the array', async () => {
    const arr = hot([1, 2]);
    const cb = mock();
    watch(arr, ($) => {
      void $.length;
      cb();
    });
    cb.mockClear();

    arr.push(3);
    await flush();
    expect(cb).toHaveBeenCalled();
  });

  it('fires on length when assigning next array index', async () => {
    const arr = hot([1, 2]);
    const cb = mock();
    watch(arr, ($) => {
      void $.length;
      cb();
    });
    cb.mockClear();

    arr[2] = 3;
    await flush();
    expect(cb).toHaveBeenCalled();
  });

  it('throws when assigning beyond the next array index', () => {
    const arr = hot([1, 2]);

    expect(() => {
      arr[3] = 4;
    }).toThrow('hot() arrays must be dense');
  });

  it('throws when growing array length', () => {
    const arr = hot([1, 2]);

    expect(() => {
      arr.length = 3;
    }).toThrow('hot() arrays must be dense');
  });

  it('iteration subscribes to length and visited indices', async () => {
    const arr = hot([1, 2, 3]);
    const cb = mock();
    watch(arr, ($) => {
      for (const _ of $) void _;
      cb();
    });
    cb.mockClear();

    arr[1] = 99;
    await flush();
    expect(cb).toHaveBeenCalled();
  });

  it('find subscribes only to indices visited up to match', async () => {
    const arr = hot([1, 2, 3, 4, 5]);
    const cb = mock();
    watch(arr, ($) => {
      $.find((v) => v === 3);
      cb();
    });
    cb.mockClear();

    arr[4] = 99;
    await flush();
    expect(cb).not.toBeCalled();

    arr[1] = 99;
    await flush();
    expect(cb).toHaveBeenCalled();
  });

  it('slice subscribes only to targeted segment', async () => {
    const arr = hot([1, 2, 3, 4, 5]);
    const cb = mock();
    watch(arr, ($) => {
      cb($.slice(1, 3));
    });
    expect(cb).toHaveBeenCalledWith([2, 3]);
    cb.mockClear();

    arr[4] = 99;
    await flush();
    expect(cb).not.toBeCalled();

    arr[2] = 99;
    await flush();
    expect(cb).toHaveBeenCalledWith([2, 99]);
  });

  it('some tracks checked indices', async () => {
    const arr = hot([0, 0, 3]);
    const cb = mock();
    watch(arr, ($) => {
      $.some((value) => value === 1);
      cb();
    });
    cb.mockClear();

    arr[0] = 1;
    await flush();
    expect(cb).toHaveBeenCalled();
  });

  it('push fires events for new index and length', async () => {
    const arr = hot([1, 2]);
    const onIndex = mock();
    const onLength = mock();
    watch(arr, ($) => {
      void $[2];
      onIndex();
    });
    watch(arr, ($) => {
      void $.length;
      onLength();
    });
    onIndex.mockClear();
    onLength.mockClear();

    arr.push(3);
    await flush();
    expect(onIndex).toHaveBeenCalled();
    expect(onLength).toHaveBeenCalled();
  });

  it('unshift fires for shifted indices and length', async () => {
    const arr = hot([2, 3]);
    const onIndex = mock();
    const onLength = mock();
    watch(arr, ($) => {
      onIndex($[0], $[2]);
    });
    watch(arr, ($) => {
      void $.length;
      onLength();
    });
    onIndex.mockClear();
    onLength.mockClear();

    arr.unshift(1);
    await flush();
    expect(onIndex).toHaveBeenCalledWith(1, 3);
    expect(onLength).toHaveBeenCalled();
  });

  it('pop fires for removed index and length', async () => {
    const arr = hot([1, 2, 3]);
    const cb = mock();
    watch(arr, ($) => {
      void $[2];
      cb();
    });
    cb.mockClear();

    arr.pop();
    await flush();
    expect(cb).toHaveBeenCalled();
  });

  it('shift fires for shifted indices and length', async () => {
    const arr = hot([1, 2, 3]);
    const onIndex = mock();
    const onLength = mock();
    watch(arr, ($) => {
      onIndex($[0], $[2]);
    });
    watch(arr, ($) => {
      void $.length;
      onLength();
    });
    onIndex.mockClear();
    onLength.mockClear();

    arr.shift();
    await flush();
    expect(onIndex).toHaveBeenCalledWith(2, undefined);
    expect(onLength).toHaveBeenCalled();
  });

  it('splice fires for removed and inserted indices', async () => {
    const arr = hot([1, 2, 3]);
    const cb = mock();
    watch(arr, ($) => {
      cb($[1], $[2]);
    });
    cb.mockClear();

    arr.splice(1, 1, 4, 5);
    await flush();
    expect(cb).toHaveBeenCalledWith(4, 5);
  });

  it('sort fires for reordered indices', async () => {
    const arr = hot([3, 1, 2]);
    const cb = mock();
    watch(arr, ($) => {
      cb($[0], $[2]);
    });
    cb.mockClear();

    arr.sort();
    await flush();
    expect(cb).toHaveBeenCalledWith(1, 3);
  });

  it('reverse fires for reordered indices', async () => {
    const arr = hot([1, 2, 3]);
    const cb = mock();
    watch(arr, ($) => {
      cb($[0], $[2]);
    });
    cb.mockClear();

    arr.reverse();
    await flush();
    expect(cb).toHaveBeenCalledWith(3, 1);
  });

  it('enumeration of keys subscribes to length', async () => {
    const arr = hot([1, 2]);
    const cb = mock();
    watch(arr, ($) => {
      expect(Object.keys($)).toEqual(
        Array.from({ length: $.length }, (_, i) => String(i))
      );
      cb();
    });
    cb.mockClear();

    arr.push(3);
    await flush();
    expect(cb).toHaveBeenCalled();
  });

  it('length truncation fires length event', async () => {
    const arr = hot([1, 2, 3]);
    const onIndex = mock();
    const onLength = mock();
    watch(arr, ($) => {
      onIndex($[2]);
    });
    watch(arr, ($) => {
      onLength($.length);
    });
    onIndex.mockClear();
    onLength.mockClear();

    arr.length = 1;
    await flush();
    expect(onIndex).toHaveBeenCalledWith(undefined);
    expect(onLength).toHaveBeenCalledWith(1);
  });

  it('throws when deleting an array index', () => {
    const arr = hot([1, 2, 3]);

    expect(() => {
      delete arr[1];
    }).toThrow('hot() arrays must be dense');
  });

  it('delete of a missing index does not fire', async () => {
    const arr = hot([1, 2, 3]);
    const cb = mock();
    watch(arr, ($) => {
      void $[2];
      cb();
    });
    cb.mockClear();

    delete arr[5];
    await flush();
    expect(cb).not.toBeCalled();
  });

  it('does not fire keyed events for symbol deletes', async () => {
    const key = Symbol('key');
    const arr = hot([1, 2, 3] as (number[] & { [key]?: number }));
    (arr as any)[key] = 4;

    const cb = mock();
    watch(arr, ($) => {
      void $[0];
      cb();
    });
    cb.mockClear();

    delete (arr as any)[key];
    await flush();
    expect(cb).not.toBeCalled();
  });
});

describe('object', () => {
  it('fires event on key write', async () => {
    const obj = hot({ a: 1, b: 2 });
    const cb = mock();
    watch(obj, ($) => {
      void $.a;
      cb();
    });
    cb.mockClear();

    obj.a = 99;
    await flush();
    expect(cb).toHaveBeenCalled();
  });

  it('does not fire on unrelated key', async () => {
    const obj = hot({ a: 1, b: 2 });
    const cb = mock();
    watch(obj, ($) => {
      void $.a;
      cb();
    });
    cb.mockClear();

    obj.b = 99;
    await flush();
    expect(cb).not.toBeCalled();
  });

  it('fires when a tracked key is added', async () => {
    const obj = hot({ a: 1 } as Record<string, number>);
    const cb = mock();
    watch(obj, ($) => {
      void $.b;
      cb();
    });
    cb.mockClear();

    obj.b = 2;
    await flush();
    expect(cb).toHaveBeenCalled();
  });

  it('fires on delete of a tracked key', async () => {
    const obj = hot({ a: 1, b: 2 } as Record<string, number>);
    const cb = mock();
    watch(obj, ($) => {
      void $.a;
      cb();
    });
    cb.mockClear();

    delete obj.a;
    await flush();
    expect(cb).toHaveBeenCalled();
  });

  it('delete of a missing key is a no-op', async () => {
    const obj = hot({ a: 1 } as Record<string, number>);
    const cb = mock();
    watch(obj, ($) => {
      void $.a;
      cb();
    });
    cb.mockClear();

    expect(delete (obj as any).missing).toBe(true);
    await flush();
    expect(cb).not.toHaveBeenCalled();
  });

  it('enumeration sees keys and values through watch proxy', () => {
    const obj = hot({ a: 1, b: 2 });

    watch(obj, ($) => {
      expect(Object.keys($)).toEqual(['a', 'b']);
      expect(Object.values($)).toEqual([1, 2]);
      expect({ ...$ }).toEqual({ a: 1, b: 2 });
    });
  });

  it('enumeration fires when a key is added', async () => {
    const obj = hot({ a: 1 } as Record<string, number>);
    const cb = mock();
    watch(obj, ($) => {
      void Object.keys($);
      cb();
    });
    cb.mockClear();

    obj.b = 2;
    await flush();
    expect(cb).toHaveBeenCalled();
  });

  it('enumeration fires when a key is deleted', async () => {
    const obj = hot({ a: 1, b: 2 } as Record<string, number>);
    const cb = mock();
    watch(obj, ($) => {
      void Object.keys($);
      cb();
    });
    cb.mockClear();

    delete obj.b;
    await flush();
    expect(cb).toHaveBeenCalled();
  });

  it('enumeration does not fire on existing-key write', async () => {
    const obj = hot({ a: 1, b: 2 });
    const cb = mock();
    watch(obj, ($) => {
      void Object.keys($);
      cb();
    });
    cb.mockClear();

    obj.a = 99;
    await flush();
    expect(cb).not.toHaveBeenCalled();
  });

  it('does not recurse into nested objects', () => {
    const obj = hot({ inner: { x: 1 } });
    expect(observer(obj.inner)).toBeUndefined();
  });

  it('supports State export', () => {
    class Test extends State {
      arr = hot([1, 2, 3]);
      obj = hot({ a: 1, b: 2 });
    }

    const test = Test.new();
    const values = test.get();

    expect(values).toEqual({
      arr: [1, 2, 3],
      obj: { a: 1, b: 2 }
    });
    expect(values.arr).not.toBe(test.arr);
    expect(values.obj).not.toBe(test.obj);
    expect(Object.isFrozen(values.arr)).toBe(true);
    expect(Object.isFrozen(values.obj)).toBe(true);
  });
});

describe('as State field', () => {
  it('reactivity works end-to-end (tic-tac-toe-style)', async () => {
    class Game extends State {
      board = hot(Array(9).fill(''));
      turn: 'X' | 'O' = 'X';
    }

    const game = Game.new();
    const cb = mock();

    game.get(($) => {
      cb($.board[0]);
    });

    expect(cb).toBeCalledWith('');

    game.board[0] = 'X';
    await flush();

    expect(cb).toBeCalledWith('X');
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('does not fire effect when an unrelated index changes', async () => {
    class Game extends State {
      board = hot(Array(9).fill(''));
    }

    const game = Game.new();
    const cb = mock();

    game.get(($) => {
      cb($.board[0]);
    });

    cb.mockClear();
    game.board[5] = 'X';
    await flush();

    expect(cb).not.toBeCalled();
  });

  it('tracks nested child State values', async () => {
    class Cell extends State {
      value = '';
    }

    class Game extends State {
      board = hot([Cell.new()]);
    }

    const game = Game.new();
    const cb = mock();

    game.get(($) => {
      cb($.board[0].value);
    });

    cb.mockClear();
    game.board[0].value = 'X';
    await flush();

    expect(cb).toHaveBeenCalledWith('X');
  });

  it('tracks nested hot child values', async () => {
    class Game extends State {
      board = hot([hot({ value: '' })]);
    }

    const game = Game.new();
    const cb = mock();

    game.get(($) => {
      cb($.board[0].value);
    });

    cb.mockClear();
    game.board[0].value = 'X';
    await flush();

    expect(cb).toHaveBeenCalledWith('X');
  });

  it('getter aggregating over keyed collection stays reactive', async () => {
    class Cart extends State {
      items: Record<string, number> = hot({});

      get count() {
        return Object.values(this.items).reduce((sum, qty) => sum + qty, 0);
      }
    }

    const cart = Cart.new();
    const cb = mock();

    cart.get(($) => cb($.count));
    expect(cb).toHaveBeenCalledWith(0);

    cart.items.pizza = 2;
    await flush();
    expect(cb).toHaveBeenCalledWith(2);

    cart.items.pizza = 5;
    await flush();
    expect(cb).toHaveBeenCalledWith(5);

    delete cart.items.pizza;
    await flush();
    expect(cb).toHaveBeenLastCalledWith(0);
  });
});
