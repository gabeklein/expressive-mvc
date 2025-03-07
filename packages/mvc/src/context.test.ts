import { Context } from './context';
import { Model } from './model';

class Example extends Model {};
class Example2 extends Example {};

it("will add instance to context", () => {
  const example = Example.new();
  const context = new Context();

  context.include(example);

  expect(context.get(Example)).toBe(example);
})

it("will create instance in context", () => {
  const context = new Context(Example);

  expect(context.get(Example)).toBeInstanceOf(Example);
})

it("will not create base Model", () => {
  // @ts-expect-error
  const attempt = () => new Context({ Model });

  expect(attempt).toThrowError("Cannot create base Model.");
})

it("will include children of Model", () => {
  class Test extends Model {
    example = new Example();
  }

  const context = new Context({ Test });

  expect(context.get(Example)).toBeInstanceOf(Example);
});

it("will not include initialized child", () => {
  class Test extends Model {
    // this will be initialized before parent is
    example = Example.new();
  }

  const context = new Context({ Test });

  expect(context.get(Example)).toBeUndefined();
});

it("will access upstream controller", () => {
  const example = Example.new();

  const context = new Context({ example });
  const context2 = context.push();

  expect(context2.get(Example)).toBe(example);
})

it("will register all subtypes", () => {
  const example2 = new Example2();
  const context = new Context({ example2 });

  expect(context.get(Example2)).toBe(example2);
  expect(context.get(Example)).toBe(example2);
})

it("will return undefined if not found", () => {
  const context = new Context();
  const got = context.get(Example);

  expect(got).toBeUndefined();
})

it("will complain if multiple registered", () => {
  const context = new Context({
    e1: Example,
    e2: Example
  });

  const fetch = () => context.get(Example);

  expect(fetch).toThrowError(`Did find Example in context, but multiple were defined.`);
})

it("will ignore if multiple but same", () => {
  const example = Example.new();
  const context = new Context({
    e1: example,
    e2: example
  });

  const got = context.get(Example);

  expect(got).toBe(example);
})

it("will destroy modules created by layer", () => {
  class Test extends Model {
    destroyed = jest.fn();

    constructor(){
      super();
      this.get(null, this.destroyed);
    }
  }

  class Test1 extends Test {};
  class Test2 extends Test {};
  class Test3 extends Test {};

  const test2 = Test2.new();

  const context1 = new Context({ Test1 });
  const context2 = context1.push({ test2, Test3 });

  const test1 = context2.get(Test1)!;
  const test3 = context2.get(Test3)!;

  context2.pop();

  expect(test1.destroyed).not.toBeCalled();
  expect(test2.destroyed).not.toBeCalled();
  expect(test3.destroyed).toBeCalled();
})

describe("include", () => {
  class Foo extends Model {}
  class Bar extends Model {}
  class FooBar extends Model {
    foo = new Foo();
  }

  it("will register in batch", () => {
    const foo = Foo.new();
    const bar = Bar.new();

    const context = new Context({ foo, bar });
  
    expect(context.get(Foo)).toBe(foo);
    expect(context.get(Bar)).toBe(bar);
  })

  it("will callback once per unique added", () => {
    const foo = Foo.new();
    const bar = Bar.new();
    const cb = jest.fn();

    const context = new Context();
    
    context.include({ foo, bar }, cb);
  
    expect(cb).toBeCalledWith(foo, true);
    expect(cb).toBeCalledWith(bar, true);
    expect(cb).toBeCalledTimes(2);

    context.include({ foo, bar }, cb);

    expect(cb).toBeCalledTimes(2);

    const foo2 = Foo.new();

    context.include({ foo, bar, foo2 }, cb);

    expect(cb).toBeCalledWith(foo2, true);
    expect(cb).toBeCalledTimes(3);
  })

  it("will assign to newly added instances", () => {
    class Test extends Model {
      value = 0;
    }

    const t1 = Test.new();
    const t2 = Test.new();

    const context = new Context();

    context.include({ t1 }, { value: 1 });

    expect(t1.value).toBe(1);

    t1.value = 2;
    
    context.include({ t1, t2 }, { value: 3 });

    // t1 is already in context, should not be reassigned.
    expect(t1.value).toBe(2);
    expect(t2.value).toBe(3);
  })

  // This will be made more elegant later.
  it("will hard-reset if inputs differ", () => {
    const bazDidDie = jest.fn();

    class Baz extends Model {
      constructor(){
        super();
        this.get(() => bazDidDie);
      }
    }

    const foo = Foo.new();
    const bar = Bar.new();
    const context = new Context({ foo, bar, Baz });

    const idPriorToUpdate = context.id;
    const baz = context.get(Baz);

    context.include({ foo, bar: Bar.new(), Baz });

    // key should change despite technically same layer.
    expect(context.id).not.toBe(idPriorToUpdate);

    // expect all instances did get replaced.
    expect(context.get(Bar)).not.toBe(bar);

    // expect Baz will have been force-replaced.
    expect(bazDidDie).toBeCalled();

    const newBaz = context.get(Baz);

    expect(newBaz).toBeInstanceOf(Baz);
    expect(newBaz).not.toBe(baz);
  })
  
  it("will register children implicitly", () => {
    const foobar = FooBar.new();
    const context = new Context({ foobar });
  
    expect(context.get(FooBar)).toBe(foobar);
    expect(context.get(Foo)).toBe(foobar.foo);
  })
  
  it("will prefer explicit over implicit", () => {
    const foo = Foo.new();
    const foobar = FooBar.new();
    const context = new Context({ foobar, foo });

    expect(context.get(FooBar)).toBe(foobar);
    expect(context.get(Foo)).not.toBe(foobar.foo);
    expect(context.get(Foo)).toBe(foo);
  })
})

it("will throw on bad include", () => {
  const context = new Context();

  expect(() => context.include(undefined as any)).toThrowError();
})

it("will throw on base Model include", () => {
  const context = new Context();

  // @ts-ignore
  expect(() => context.include({ Model })).toThrowError("Cannot create base Model.");
});

it("will throw on bad include property", () => {
  const context = new Context();

  // @ts-ignore
  expect(() => context.include({ Thing: undefined })).toThrowError(
    "Context may only include instance or class `extends Model` but got undefined (as 'Thing')."
  );
})