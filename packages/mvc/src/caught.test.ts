import { describe, expect, it } from 'vitest';

import { Caught } from './caught';
import { State } from './state';

describe('name', () => {
  class Test extends State {}

  it('will name each case', () => {
    const test = Test.new();

    expect(new Caught(test, 'x').name).toBe('Caught');
    expect(new Caught.Destroyed(test, 'foo').name).toBe('Caught.Destroyed');
    expect(new Caught.Inactive(test).name).toBe('Caught.Inactive');
    expect(new Caught.Getter(test, 'foo', 0).name).toBe('Caught.Getter');
    expect(new Caught.Init(test, 0).name).toBe('Caught.Init');
    expect(new Caught.Effect(test, 0).name).toBe('Caught.Effect');
  });

  it('will head the stack with its case', () => {
    const error = new Caught.Effect(Test.new(), new Error('boom'));

    expect(String(error)).toBe(`Caught.Effect: ${error.message}`);
    expect(error.stack!.split('\n')[0]).toBe(`Caught.Effect: ${error.message}`);
  });
});
