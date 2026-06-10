import { describe, expect, it, mock } from 'bun:test';

import { State, use } from '.';

class Test extends State {
  value = 'foo';
}

describe('use', () => {
  it('will subscribe to an existing instance', () => {
    const test = Test.new();
    const proxy = use(test);

    expect(proxy.value()).toBe('foo');

    test.value = 'bar';

    expect(proxy.value()).toBe('bar');
  });

  it('will activate an unready instance', () => {
    const didCreate = mock();

    class Test extends State {
      protected new() {
        didCreate();
      }
    }

    const test = new (Test as unknown as State.Type<Test>)();

    expect(didCreate).not.toBeCalled();

    use(test);

    expect(didCreate).toBeCalled();
  });

  it('will not destroy subject', () => {
    const test = Test.new();

    use(test);

    expect(() => (test.value = 'bar')).not.toThrow();
  });

  it('will throw if object is not observable', () => {
    expect(() => use({} as any)).toThrow(
      'Provided object is not observable.'
    );
  });

  it('will throw if object is destroyed', () => {
    const test = Test.new();

    test.set(null);

    expect(() => use(test)).toThrow(
      'Provided object is no longer observable.'
    );
  });
});
