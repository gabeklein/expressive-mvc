import { describe, expect, it } from 'vitest';

import { Component } from '@expressive/mvc';
import { childrenOf, propsOf, typeOf } from '@expressive/mvc/runtime';

import { jsx } from './node';

class Thing extends Component {}

describe('jsx', () => {
  it('will create an element', () => {
    const element = jsx(Thing, { visible: true }, 'a');

    expect(typeOf(element)).toBe(Thing);
    expect(propsOf(element)).toEqual({ visible: true });
    expect(element.key).toBe('a');
  });

  it('will normalize an absent key', () => {
    expect(jsx(Thing, {}).key).toBe(null);
  });

  it('will not report a type or props for a foreign node', () => {
    expect(typeOf({})).toBe(undefined);
    expect(propsOf({})).toEqual({});
  });
});

describe('childrenOf', () => {
  it('will flatten nested arrays and iterables', () => {
    const a = jsx(Thing, {});
    const b = jsx(Thing, {});
    const c = jsx(Thing, {});

    expect(childrenOf([a, [b], new Set([c])])).toEqual([a, b, c]);
  });

  it('will drop nothing-values', () => {
    const a = jsx(Thing, {});

    expect(childrenOf([null, undefined, false, true, a])).toEqual([a]);
  });

  it('will keep a Component instance', () => {
    const thing = Thing.new();

    expect(childrenOf(thing)).toEqual([thing]);
  });

  it('will throw if given text', () => {
    expect(() => childrenOf('hello')).toThrowError(/cannot contain "hello"/);
  });

  it('will throw if given a number', () => {
    expect(() => childrenOf(42)).toThrowError(/cannot contain 42/);
  });
});
