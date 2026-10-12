import { describe, expect, it } from 'bun:test';
import { Component } from '@expressive/mvc';
import { propsOf, typeOf } from '@expressive/mvc/jsx-runtime';

import { childrenOf, isElement, jsx, Fragment } from './jsx-runtime';
import { jsxDEV } from './jsx-dev-runtime';

class Thing extends Component {
  label = '';
}

describe('element', () => {
  it('will create elements', () => {
    const node = <Thing key="a" label="b" />;

    expect(isElement(node)).toBe(true);
    expect(typeOf(node)).toBe(Thing);
    expect(propsOf(node)).toEqual({ label: 'b' });
  });

  it('will identify fragments', () => {
    const node = <>{'a'}</>;

    expect(isElement(node)).toBe(true);
    expect(typeOf(node)).toBe(Fragment);
  });

  it('will create elements in dev transform', () => {
    const node = jsxDEV(Thing, { label: 'b' }, 'a', false, undefined, undefined);

    expect(isElement(node)).toBe(true);
    expect(typeOf(node)).toBe(Thing);
  });

  it('will reject non-elements', () => {
    expect(isElement('text')).toBe(false);
    expect(isElement(null)).toBe(false);
    expect(isElement({})).toBe(false);
    expect(typeOf('text')).toBe(undefined);
    expect(propsOf('text')).toEqual({});
  });
});

describe('childrenOf', () => {
  it('will wrap a single child', () => {
    expect(childrenOf('only')).toEqual(['only']);
    expect(childrenOf(0)).toEqual([0]);
  });

  it('will flatten nested arrays', () => {
    expect(childrenOf(['a', ['b', ['c']]])).toEqual(['a', 'b', 'c']);
  });

  it('will drop empty values', () => {
    expect(childrenOf(null)).toEqual([]);
    expect(childrenOf(undefined)).toEqual([]);
    expect(childrenOf(true)).toEqual([]);
    expect(childrenOf(['a', false, null, 'b'])).toEqual(['a', 'b']);
  });

  it('will keep elements intact', () => {
    const node = jsx(Thing, {});
    expect(childrenOf([node])).toEqual([node]);
  });
});
