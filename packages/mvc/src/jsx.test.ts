import { afterEach, describe, expect, it, vi } from 'vitest';

import { adopter, renderable } from './jsx';
import { has } from './field/has';
import { map } from './field/map';
import { Model } from './state';

afterEach(() => adopter(undefined));

describe('renderable', () => {
  it('will replay declarations made before a host adopts', () => {
    const adopt = vi.fn();
    const proto = {};
    const members = () => [];

    renderable(proto, members);
    adopter(adopt);

    expect(adopt).toHaveBeenCalledWith(proto, members);
  });

  it('will adopt a declaration made after', () => {
    const adopt = vi.fn();
    const proto = {};
    const members = () => [];

    adopter(adopt);
    renderable(proto, members);

    expect(adopt).toHaveBeenCalledWith(proto, members);
  });

  it('will stop adopting once cleared', () => {
    const adopt = vi.fn();

    adopter(adopt);
    adopt.mockClear(); // the replay of earlier declarations
    adopter(undefined);
    renderable({}, () => []);

    expect(adopt).not.toHaveBeenCalled();
  });
});

describe('collections', () => {
  it('will declare lists, pools and maps', () => {
    const adopted = new Map<object, (self: any) => unknown[]>();

    adopter((proto, members) => adopted.set(proto, members));

    class Row extends Model {}

    class Test extends Model {
      list = has([1, 2]);
      pool = has(Row);
      map = map([['a', 1]]);
    }

    const { list, pool, map: entries } = Test.new();

    expect(adopted.get(Object.getPrototypeOf(list))!(list)).toEqual([1, 2]);
    expect(adopted.get(Object.getPrototypeOf(pool))!(pool)).toEqual([]);
    expect(adopted.get(Object.getPrototypeOf(entries))!(entries)).toEqual([1]);
  });
});
