import { State } from '@expressive/mvc';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { attach, inspect } from './index';
import { dispatch } from './dispatch';

class Composer extends State {
  draft = '';
}

beforeEach(() => {
  globalThis.__EXPRESSIVE_INSPECT__ = inspect;
  attach();
});

afterEach(() => {
  globalThis.__EXPRESSIVE_INSPECT__ = undefined;
});

describe('dispatch', () => {
  it('will call a member of the inspector', () => {
    Composer.new();
    expect(dispatch([['get'], ['Composer.draft']])).toBe('');
    expect(dispatch([['journal', 'seq'], []])).toBe(0);
  });

  it('will take the call as the second argument, after a locator element', () => {
    Composer.new();
    expect(dispatch({}, [['get'], ['Composer.draft']])).toBe('');
  });

  it('will refuse to walk off the inspector', () => {
    for (const path of [
      ['constructor', 'constructor'],
      ['__proto__'],
      ['get', 'call'],
      ['get', 'constructor'],
      ['journal', 'constructor'],
      ['hasOwnProperty']
    ])
      expect(() => dispatch([path, ['return 1']])).toThrow(`No inspector method ${path.join('.')}.`);
  });

  it('will refuse a member which is not a function', () => {
    expect(() => dispatch([['get', 'name'], []])).toThrow('No inspector method get.name.');
    expect(() => dispatch([[], []])).toThrow('No inspector method .');
  });
});
