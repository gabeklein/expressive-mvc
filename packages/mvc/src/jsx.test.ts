import { afterEach, describe, expect, it, vi } from 'vitest';

import { adopter, renderable } from './jsx';
import { Component } from './component';
import { has } from './field/has';
import { map } from './field/map';
import { Model } from './state';

afterEach(() => adopter(undefined));

describe('renderable', () => {
  it('will replay declarations made before a host adopts', () => {
    const adopt = vi.fn();
    class Type {}

    renderable(Type);
    adopter(adopt);

    expect(adopt).toHaveBeenCalledWith(Type);
  });

  it('will adopt a declaration made after', () => {
    const adopt = vi.fn();
    class Type {}

    adopter(adopt);
    renderable(Type);

    expect(adopt).toHaveBeenCalledWith(Type);
  });

  it('will stop adopting once cleared', () => {
    const adopt = vi.fn();

    adopter(adopt);
    adopt.mockClear(); // the replay of earlier declarations
    adopter(undefined);
    renderable(class {});

    expect(adopt).not.toHaveBeenCalled();
  });

  it('will declare Component, lists, pools and maps', () => {
    const adopted = new Set<Function>();

    adopter((Type) => adopted.add(Type));

    expect(adopted).toContain(Component);
    expect(adopted).toContain(has.List);
    expect(adopted).toContain(has.Pool);
    expect(adopted).toContain(map.Managed);
  });
});

describe('protocol', () => {
  class Row extends Model {}

  class Test extends Model {
    list = has([1, 2]);
    pool = has(Row);
    map = map([['a', 1]]);
  }

  it('will render members', () => {
    const { list, pool, map: entries } = Test.new();
    const row = pool.add();

    expect(list.render()).toEqual([1, 2]);
    expect(pool.render()).toEqual([row]);
    expect(entries.render()).toEqual([1]);
  });

  it('will resolve a derived view to its instance', () => {
    const { list, pool, map: entries } = Test.new();

    expect(list.is).toBe(list);
    expect(Object.create(list).is).toBe(list);
    expect(Object.create(pool).is).toBe(pool);
    expect(Object.create(entries).is).toBe(entries);
  });
});
