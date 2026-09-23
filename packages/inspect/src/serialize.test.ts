import { State, has, map } from '@expressive/mvc';
import { describe, expect, it } from 'vitest';

import { entries, parsePath, serialize, walk } from './serialize';

class Child extends State {
  name = 'kid';
}

class Parent extends State {
  child = new Child();
  kids = has(Child);
  lookup = map<string, number>();
  plain = { deep: { deeper: { deepest: 1 } } };
  list = [1, 2, 3];
}

describe('parsePath', () => {
  it('will split target from path', () => {
    expect(parsePath(' Foo.bar.baz ')).toEqual({ target: 'Foo', path: 'bar.baz' });
  });

  it('will return only target when no dot', () => {
    expect(parsePath('Foo')).toEqual({ target: 'Foo' });
    expect(parsePath('.foo')).toEqual({ target: '.foo' });
  });
});

describe('walk', () => {
  it('will read stored values without accessors', () => {
    class Lazy extends State {
      value = 1;
    }
    const lazy = Lazy.new();
    expect(walk(lazy, 'value')).toBe(1);
    expect(walk(lazy)).toBe(lazy);
    expect(walk(lazy, 'missing.deeper')).toBeUndefined();
    expect(walk(5, 'x')).toBeUndefined();
  });

  it('will step through child states, maps, and objects', () => {
    const parent = Parent.new();
    parent.lookup.set('a', 7);
    expect(walk(parent, 'child.name')).toBe('kid');
    expect(walk(parent, 'lookup.a')).toBe(7);
    expect(walk(parent, 'plain.deep.deeper.deepest')).toBe(1);
    expect(walk(parent, 'list.1')).toBe(2);
  });
});

describe('serialize', () => {
  it('will expand a root state and collapse nested states to refs', () => {
    const parent = Parent.new();
    const out = serialize(parent) as Record<string, any>;
    expect(out.$ref).toBe(String(parent));
    expect(out.$type).toBe('Parent');
    expect(out.child).toEqual({ $ref: String(parent.child), $type: 'Child' });
    expect(out.list).toEqual([1, 2, 3]);
  });

  it('will list pools and maps', () => {
    const parent = Parent.new();
    const kid = parent.kids.add();
    parent.lookup.set('a', 1);
    expect(serialize(parent.kids)).toEqual([{ $ref: String(kid), $type: 'Child' }]);
    expect(serialize(parent.lookup)).toEqual({ a: 1 });
  });

  it('will summarize past depth', () => {
    const parent = Parent.new();
    expect(serialize(parent.plain, 1)).toEqual({ deep: '{1}' });
    expect(serialize([[1, 2]], 1)).toEqual(['[2]']);
    expect(serialize(new Map([['a', 1]]), 0)).toBe('{1}');
  });

  it('will cap strings, arrays, and keys', () => {
    const long = 'x'.repeat(300);
    expect((serialize(long) as string).length).toBe(240);
    expect((serialize(long) as string).endsWith('…')).toBe(true);

    const many = Array.from({ length: 30 }, (_, i) => i);
    const arr = serialize(many) as unknown[];
    expect(arr.length).toBe(25);
    expect(arr[24]).toBe('…+6');

    const wide = Object.fromEntries(Array.from({ length: 45 }, (_, i) => [`k${i}`, i]));
    const obj = serialize(wide) as Record<string, unknown>;
    expect(Object.keys(obj).length).toBe(41);
    expect(obj['…']).toBe(5);
  });

  it('will render scalars and specials as JSON-safe values', () => {
    expect(serialize(null)).toBeNull();
    expect(serialize(undefined)).toBeUndefined();
    expect(serialize(true)).toBe(true);
    expect(serialize(1.5)).toBe(1.5);
    expect(serialize(NaN)).toBe('NaN');
    expect(serialize(10n)).toBe('10n');
    expect(serialize(Symbol('s'))).toBeUndefined();
    expect(serialize(() => 1)).toBeUndefined();
    expect(serialize(new Date(0))).toBe('1970-01-01T00:00:00.000Z');
    expect(serialize(new Error('boom'))).toEqual({ name: 'Error', message: 'boom' });
    expect(serialize(Promise.resolve())).toBe('(pending)');
    expect(serialize({ is: 1, fn: () => 1, ok: 2 })).toEqual({ ok: 2 });
  });

  it('will read raw entries', () => {
    const child = Child.new();
    expect([...entries(child)]).toEqual([['name', 'kid']]);
  });
});
