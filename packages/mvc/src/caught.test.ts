import { describe, expect, it, vi } from 'vitest';

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

describe('cause', () => {
  class Test extends State {}

  it('will keep whatever was thrown, falsy included', () => {
    const test = Test.new();

    for (const thrown of [0, '', false, null, undefined])
      expect(new Caught.Effect(test, thrown)).toHaveProperty('cause', thrown);
  });

  it('will not carry a cause where none applies', () => {
    const test = Test.new();

    expect('cause' in new Caught.Destroyed(test, 'foo')).toBe(false);
    expect('cause' in new Caught(test, 'x')).toBe(false);
  });
});

describe('message', () => {
  class Test extends State {}

  it('will carry what was thrown', () => {
    const test = Test.new();

    expect(new Caught.Effect(test, new Error('boom')).message).toBe(`An exception was thrown by an effect of ${test}: boom`);
    expect(new Caught.Getter(test, 'foo', 'bad').message).toBe(`An exception was thrown while refreshing ${test}.foo: bad`);
    expect(new Caught.Init(test, 0).message).toBe(`Async error in constructor for ${test}: 0`);
  });

  it('will end at the state when the cause has no message', () => {
    const test = Test.new();

    expect(new Caught.Effect(test, new Error()).message).toBe(`An exception was thrown by an effect of ${test}.`);
  });
});

describe('log', () => {
  class Test extends State {}

  it('will log and handle an error', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const report = new Caught.Effect(Test.new(), new Error('boom'));

    expect(Caught.log(report)).toBeUndefined();
    expect(error).toHaveBeenCalledWith(report);
    error.mockRestore();
  });

  it('will pass on warnings and destroyed writes', () => {
    const test = Test.new();
    const inactive = new Caught.Inactive(test);
    const destroyed = new Caught.Destroyed(test, 'foo');

    expect(Caught.log(inactive)).toBe(inactive);
    expect(Caught.log(destroyed)).toBe(destroyed);
  });

  it('will serve as a catch handler', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    class Faulty extends State {
      value = 0;
    }

    const stop = Faulty.on({ catch: Caught.log });
    const faulty = Faulty.new();

    faulty.get((current) => {
      if (current.value) throw new Error('effect failed');
    });

    faulty.value = 1;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(error).toHaveBeenCalledWith(expect.any(Caught.Effect));
    expect(error.mock.calls[0][0].message).toMatch(/effect failed$/);
    stop();
    error.mockRestore();
  });
});

