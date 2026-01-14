import { Context } from './context';
import { Model } from './model';

class Example extends Model {}
class Example2 extends Example {}

it('will add instance to context', () => {
  const example = Example.new();
  const context = new Context();

  context.use(example);

  expect(context.get(Example)).toBe(example);
});

it('will UID context', () => {
  const contextA = new Context();
  const contextB = new Context();

  expect(String(contextA)).toBe('Context-' + contextA.id);
  expect(String(contextA)).not.toBe(String(contextB));
});

it('will create instance in context', () => {
  const context = new Context(Example);

  expect(context.get(Example)).toBeInstanceOf(Example);
});

it("will throw if context doesn't exist if required", () => {
  const context = new Context();

  const attempt = () => context.get(Example, true);

  expect(attempt).toThrowError('Could not find Example in context.');
});

it('will not create base Model', () => {
  // @ts-expect-error
  const attempt = () => new Context({ Model });

  expect(attempt).toThrowError('Cannot create base Model.');
});

it('will include children of Model', () => {
  class Test extends Model {
    example = new Example();
  }

  const context = new Context({ Test });

  expect(context.get(Example)).toBeInstanceOf(Example);
});

it('will not include initialized child', () => {
  class Test extends Model {
    // this will be initialized before parent is
    example = Example.new();
  }

  const context = new Context({ Test });

  expect(context.get(Example)).toBeUndefined();
});

it('will access upstream controller', () => {
  const example = Example.new();

  const context = new Context({ example });
  const context2 = context.push();

  expect(context2.get(Example)).toBe(example);
});

it('will register all subtypes', () => {
  const example2 = new Example2();
  const context = new Context({ example2 });

  expect(context.get(Example2)).toBe(example2);
  expect(context.get(Example)).toBe(example2);
});

it('will return undefined if not found', () => {
  const context = new Context();
  const got = context.get(Example);

  expect(got).toBeUndefined();
});

it('will complain if multiple registered', () => {
  const context = new Context({
    e1: Example,
    e2: Example
  });

  const fetch = () => context.get(Example);

  expect(fetch).toThrowError(
    `Did find Example in context, but multiple were defined.`
  );
});

it('will ignore if multiple but same', () => {
  const example = Example.new();
  const context = new Context({
    e1: example,
    e2: example
  });

  const got = context.get(Example);

  expect(got).toBe(example);
});

it('will destroy modules created by layer', () => {
  class Test extends Model {
    destroyed = jest.fn();

    constructor() {
      super();
      this.get(null, this.destroyed);
    }
  }

  class Test1 extends Test {}
  class Test2 extends Test {}
  class Test3 extends Test {}

  const test2 = Test2.new();

  const context1 = new Context({ Test1 });
  const context2 = context1.push({ test2, Test3 });

  const test1 = context2.get(Test1)!;
  const test3 = context2.get(Test3)!;

  context2.pop();

  expect(test1.destroyed).not.toBeCalled();
  expect(test2.destroyed).not.toBeCalled();
  expect(test3.destroyed).toBeCalled();
});

describe('include', () => {
  class Foo extends Model {}
  class Bar extends Model {}
  class FooBar extends Model {
    foo = new Foo();
  }

  it('will register in batch', () => {
    const foo = Foo.new();
    const bar = Bar.new();

    const context = new Context({ foo, bar });

    expect(context.get(Foo)).toBe(foo);
    expect(context.get(Bar)).toBe(bar);
  });

  it('will callback once per unique added', () => {
    const foo = Foo.new();
    const bar = Bar.new();
    const cb = jest.fn();

    const context = new Context();

    context.use({ foo, bar }, cb);

    expect(cb).toBeCalledWith(foo);
    expect(cb).toBeCalledWith(bar);
    expect(cb).toBeCalledTimes(2);

    context.use({ foo, bar }, cb);

    expect(cb).toBeCalledTimes(2);

    const foo2 = Foo.new();

    context.use({ foo, bar, foo2 }, cb);

    expect(cb).toBeCalledWith(foo2);
    expect(cb).toBeCalledTimes(3);
  });

  it('will include multiple', () => {
    const foo = Foo.new();
    const bar = Bar.new();

    const context = new Context();

    context.use(foo);
    context.use(bar);

    expect(context.get(Foo)).toBe(foo);
    expect(context.get(Bar)).toBe(bar);
  });

  it('will ignore subsequent if callback', () => {
    const cb = jest.fn();
    const context = new Context();

    context.use(Foo, cb);
    context.use(Foo, cb);

    expect(context.get(Foo)).toBeInstanceOf(Foo);

    expect(cb).toBeCalledTimes(1);
  });

  it('will override multiple same', () => {
    const context = new Context();
    const fetch = () => context.get(Foo);

    context.use(Foo);
    context.use(Foo);

    expect(fetch).toThrowError(
      `Did find Foo in context, but multiple were defined.`
    );
  });

  // This will be made more elegant later.
  it('will hard-reset if inputs differ', () => {
    const bazDidDie = jest.fn();

    class Baz extends Model {
      constructor() {
        super();
        this.get(() => bazDidDie);
      }
    }

    const foo = Foo.new();
    const bar = Bar.new();
    const context = new Context({ foo, bar, Baz });

    const idPriorToUpdate = context.id;
    const baz = context.get(Baz);

    context.use({ foo, bar: Bar.new(), Baz });

    // key should change despite technically same layer.
    expect(context.id).not.toBe(idPriorToUpdate);

    // expect all instances did get replaced.
    expect(context.get(Bar)).not.toBe(bar);

    // expect Baz will have been force-replaced.
    expect(bazDidDie).toBeCalled();

    const newBaz = context.get(Baz);

    expect(newBaz).toBeInstanceOf(Baz);
    expect(newBaz).not.toBe(baz);
  });

  it('will register children implicitly', () => {
    const foobar = FooBar.new();
    const context = new Context({ foobar });

    expect(context.get(FooBar)).toBe(foobar);
    expect(context.get(Foo)).toBe(foobar.foo);
  });

  it('will prefer explicit over implicit', () => {
    const foo = Foo.new();
    const foobar = FooBar.new();
    const context = new Context({ foobar, foo });

    expect(context.get(FooBar)).toBe(foobar);
    expect(context.get(Foo)).not.toBe(foobar.foo);
    expect(context.get(Foo)).toBe(foo);
  });
});

it('will pop child context', () => {
  class Test extends Model {
    constructor(...args: Model.Args) {
      super(args);
      this.set(() => {
        didDestroy(this.constructor.name);
      }, null);
    }
  }

  class Test2 extends Test {}
  class Test3 extends Test {}

  const didDestroy = jest.fn();
  const context = new Context({ Test });

  context.push({ Test2 }).push({ Test3 });
  context.pop();

  expect(didDestroy).nthCalledWith(1, 'Test3');
  expect(didDestroy).nthCalledWith(2, 'Test2');
  expect(didDestroy).nthCalledWith(3, 'Test');
});

it('will throw on bad include', () => {
  const context = new Context();

  expect(() => context.use(undefined as any)).toThrowError();
});

it('will throw on base Model include', () => {
  const context = new Context();

  // @ts-ignore
  expect(() => context.use({ Model })).toThrowError(
    'Cannot create base Model.'
  );
});

it('will throw on bad include property', () => {
  const context = new Context();

  // @ts-ignore
  expect(() => context.use({ Thing: undefined })).toThrowError(
    "Context may only include instance or class `extends Model` but got undefined (as 'Thing')."
  );
});

it('will throw on bad include property (no alias)', () => {
  const context = new Context();

  // @ts-ignore
  expect(() => context.use({ [0]: undefined })).toThrowError(
    'Context may only include instance or class `extends Model` but got undefined.'
  );
});

describe('Context.get callback overload (downstream registration)', () => {
  class DownstreamModel extends Model {}

  it('should call callback when type is added downstream', () => {
    const context = new Context();
    const cb = jest.fn();

    // Register callback for DownstreamModel
    context.get(DownstreamModel, cb);

    // Add DownstreamModel after callback registration
    context.push(DownstreamModel);

    // Callback should be called with the instance
    expect(cb).toBeCalledTimes(1);
    expect(cb.mock.calls[0][0]).toBeInstanceOf(DownstreamModel);
  });

  it('should clean up callback when context is popped', () => {
    const context = new Context();
    const cb = jest.fn();

    // Register callback for DownstreamModel
    const cancel = context.get(DownstreamModel, cb);

    // Add DownstreamModel after callback registration
    context.push(DownstreamModel);

    // Callback should be called
    expect(cb).toBeCalledTimes(1);

    // Remove callback
    cancel();

    // Add another DownstreamModel (simulate re-adding)
    context.push(DownstreamModel);

    // Callback should not be called again
    expect(cb).toBeCalledTimes(1);

    context.pop();
  });

  it('should call callback when inner is popped', () => {
    const context = new Context();
    const cleanup = jest.fn();
    const cb = jest.fn(() => cleanup);

    context.get(DownstreamModel, cb);

    // Create a child context and register callback there
    const child = context.push(DownstreamModel);

    expect(cb).toBeCalledTimes(1);

    // Pop child context
    child.pop();

    expect(cleanup).toBeCalledTimes(1);
  });
});
