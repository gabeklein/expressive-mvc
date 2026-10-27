import { afterEach, describe, expect, it, vi } from 'vitest';

import { element, elements } from './element';
import { Component } from './component';
import { has } from './field/has';
import { map } from './field/map';
import { Model } from './state';

afterEach(() => elements(undefined));

describe('element', () => {
  it('will replay declarations made before a host seams', () => {
    const seam = vi.fn();
    class Type {}

    element(Type);
    elements(seam);

    expect(seam).toHaveBeenCalledWith(Type);
  });

  it('will seam a declaration made after', () => {
    const seam = vi.fn();
    class Type {}

    elements(seam);
    element(Type);

    expect(seam).toHaveBeenCalledWith(Type);
  });

  it('will stop once cleared', () => {
    const seam = vi.fn();

    elements(seam);
    seam.mockClear(); // the replay of earlier declarations
    elements(undefined);
    element(class {});

    expect(seam).not.toHaveBeenCalled();
  });

  it('will declare Component, lists, pools and maps', () => {
    const seen = new Set<Function>();

    elements((Type) => seen.add(Type));

    expect(seen).toContain(Component);
    expect(seen).toContain(has.List);
    expect(seen).toContain(has.Pool);
    expect(seen).toContain(map.Managed);
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
