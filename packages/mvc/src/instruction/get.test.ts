import { Context } from '../context';
import { mockPromise } from '../mocks';
import { State } from '../state';
import { get } from './get';
import { use } from './use';
// is this desirable?
it.todo('will add pending compute to frame immediately');
it.todo('will suspend if necessary');

describe('fetch mode', () => {
  it.skip('will fetch sibling', () => {
    class Ambient extends State {}
    class Test extends State {
      sibling = get(Test);
    }

    const test = Test.new();

    new Context({ Ambient, test });

    expect(test.sibling).toBe(test);
  });

  it('will not be enumerable', () => {
    class Ambient extends State {}
    class Test extends State {
      ambient = get(Ambient);
      foo = 'bar';
    }
    const test = Test.new();
    const ambient = Ambient.new();

    new Context({ ambient, test });

    expect(test.ambient).toBe(ambient);
    expect(Object.keys(test)).toMatchObject(['foo']);
  });

  it('will fetch multiple', () => {
    class Ambient extends State {}
    class Test extends State {
      ambient1 = get(Ambient);
      ambient2 = get(Ambient);
    }

    const test = Test.new();
    const ambient = Ambient.new();

    new Context({ ambient }).push({ test });

    expect(test.ambient1).toBe(ambient);
    expect(test.ambient2).toBe(ambient);
  });

  it('will allow overwrite', async () => {
    class Foo extends State {
      bar = new Bar();
      value = 'foo';
    }

    class Bar extends State {
      value = 'foo';
      foo = get(Foo);
    }

    const foo = Foo.new();
    const mockEffect = jest.fn();
    let promise = mockPromise();

    expect(foo.bar.foo).toBe(foo);

    foo.get((state) => {
      mockEffect(state.bar.foo.value);
      promise.resolve();
    });

    promise = mockPromise();
    foo.value = 'bar';
    await promise;

    expect(mockEffect).toBeCalledWith('bar');

    promise = mockPromise();
    foo.bar.foo = Foo.new();
    await promise;

    expect(mockEffect).toBeCalledWith('foo');
    expect(mockEffect).toBeCalledTimes(3);
  });

  it('creates parent-child relationship', () => {
    class Foo extends State {
      child = new Bar();
    }
    class Bar extends State {
      parent = get(Foo);
    }

    const foo = Foo.new();
    const bar = foo.child;

    expect(bar).toBeInstanceOf(Bar);
    expect(bar.parent).toBe(foo);
  });

  it('throws when standalone but expects parent', () => {
    class Parent extends State {}
    class Child extends State {
      expects = get(Parent, true);
    }

    const attempt = () => Child.new('ID');

    expect(attempt).toThrowError(
      `ID may only exist as a child of type Parent.`
    );
  });

  it('will throw if not found in context', () => {
    class Parent extends State {}
    class Child extends State {
      expects = get(Parent);
      constructor() {
        super('ID');
      }
    }

    const attempt = () => new Context({ Child });

    // should this throw immediately, or only on access?
    expect(attempt).toThrowError(
      `Required Parent not found in context for ID.`
    );
  });

  it('will return undefined if required is false', () => {
    class MaybeParent extends State {}
    class StandAlone extends State {
      maybe = get(MaybeParent, false);
    }

    const instance = StandAlone.new();

    new Context({ instance });

    expect(instance.maybe).toBeUndefined();
  });

  it('will throw if parent is of incorrect type', () => {
    class Expected extends State {}
    class Unexpected extends State {
      child = new Adopted('ID');
    }
    class Adopted extends State {
      expects = get(Expected, true);
    }

    const attempt = () => Unexpected.new('ID');

    expect(attempt).toThrowError(
      `New ID created as child of ID, but must be instanceof Expected.`
    );
  });

  it('will not throw if has parent but not type-required', () => {
    class Expected extends State {}
    class Unexpected extends State {
      child = new Adopted('ID');
    }
    class Adopted extends State {
      expects = get(Expected);
    }

    const attempt = () => Unexpected.new('ID');

    expect(attempt).not.toThrow();
  });

  it('will track recursively', async () => {
    class Child extends State {
      value = 'foo';
      parent = get(Parent);
    }

    class Parent extends State {
      child = new Child();
      value = 'foo';
    }

    const { child } = Parent.new();
    const effect = jest.fn((it: Child) => {
      void it.value;
      void it.parent.value;
    });

    child.get(effect);

    child.value = 'bar';
    await expect(child).toHaveUpdated();
    expect(effect).toHaveBeenCalledTimes(2);

    child.parent.value = 'bar';
    await expect(child.parent).toHaveUpdated();
    expect(effect).toHaveBeenCalledTimes(3);
  });

  it('will inherit parent context', () => {
    class Foo extends State {}
    class Bar extends State {
      baz = use(Baz);
    }

    class Baz extends State {
      foo = get(Foo);
    }

    const context = new Context({ Foo, Bar });
    const bar = context.get(Bar, true);

    expect(bar.baz.foo).toBeInstanceOf(Foo);
  });
});

describe('callback', () => {
  it('will subscribe to found instance', async () => {
    class Remote extends State {
      value = 'foo';
    }

    const remoteEffect = jest.fn((remote: Remote) => {
      void remote.value;
    });

    class Test extends State {
      remote = get(Remote, remoteEffect);
    }

    const remote = Remote.new();
    const test = Test.new();

    new Context({ remote, test });

    expect(remoteEffect).toBeCalledTimes(1);

    remote.value = 'bar';
    await remote.set();

    expect(remoteEffect).toBeCalledTimes(2);
  });
});

// TODO: not yet implemented by Context yet; this is a hack.
describe.skip('replaced source', () => {
  class Source extends State {}

  class Test extends State {
    source = get(Source);
  }

  it('will update', async () => {
    const test = Test.new();
    const oldSource = Source.new('Foo');
    const context = new Context({ test, source: oldSource });

    expect(test.source).toBe(oldSource);

    const newSource = Source.new('Bar');

    context.use({ source: newSource });

    await expect(test).toHaveUpdated();
    expect(test.source).toBe(newSource);

    await expect(test).toHaveUpdated();
    expect(test.source).toBe('Hello Baz!');
  });

  it('will not update from previous source', async () => {
    const test = Test.new();
    const oldSource = Source.new('Foo');
    const context = new Context({ test, source: oldSource });

    expect(test.source).toBe('Hello Foo!');

    context.use({
      source: Source.new('Bar')
    });

    await expect(test).toHaveUpdated();
    expect(test.source).toBe('Hello Bar!');

    // oldSource.value = "Baz";
    // await expect(test).not.toHaveUpdated();
  });

  it('will maintain subscription', async () => {
    class Remote extends State {
      value = 'foo';
    }

    const remoteEffect = jest.fn((remote: Remote) => {
      void remote.value;
    });

    class Test extends State {
      remote = get(Remote, remoteEffect);
    }

    let remote = Remote.new();
    const test = Test.new();
    const context = new Context({ remote, test });

    expect(remoteEffect).toBeCalledTimes(1);

    remote.value = 'bar';
    await remote.set();

    expect(remoteEffect).toBeCalledTimes(2);

    // TODO: Instruction does not seem to be notified of change.
    remote = Remote.new();
    context.use({ remote });

    await test.set();
    expect(remoteEffect).toBeCalledTimes(3);

    remote.value = 'boo';
    expect(remoteEffect).toBeCalledTimes(4);
  });
});

describe('async', () => {
  class Foo extends State {
    value = 'foobar';
  }

  it('will suspend if not ready', async () => {
    class Bar extends State {
      foo = get(Foo);
    }

    const bar = Bar.new();
    let caught: unknown;

    setTimeout(() => new Context({ Foo, bar }));

    try {
      void bar.foo;
      throw false;
    } catch (err) {
      expect(err).toBeInstanceOf(Promise);
      caught = err;
    }

    await expect(caught).resolves.toBeInstanceOf(Foo);
    expect(bar.foo).toBeInstanceOf(Foo);
  });
});
