import { Context, Oops } from './context';
import { Model } from './model';

class Example extends Model {};
class Example2 extends Example {};

it("will add instance to context", () => {
  const context = new Context();
  const example = Example.new();

  context.add(example);

  expect(context.get(Example)).toBe(example);
})

it("will access upstream model", () => {
  const context = new Context();
  const context2 = context.push();
  const example = Example.new();

  context.add(example);

  expect(context2.get(Example)).toBe(example);
})

it("will register all subtypes", () => {
  const context = new Context();
  const example2 = new Example2();

  context.add(example2);

  expect(context.get(Example2)).toBe(example2);
  expect(context.get(Example)).toBe(example2);
})

it("will create instance in context", () => {
  const context = new Context();

  context.add(Example);
  expect(context.get(Example)).toBeInstanceOf(Example);
})

it("will return undefined if not found", () => {
  const context = new Context();
  const got = context.get(Example);

  expect(got).toBeUndefined();
})

it("will complain if multiple registered", () => {
  const context = new Context();
  const expected = Oops.MultipleExist(Example);
  const fetch = () => context.get(Example);

  context.add(Example);
  context.add(Example);

  expect(fetch).toThrowError(expected);
})

it("will ignore if multiple but same", () => {
  const context = new Context();
  const example = Example.new();

  context.add(example);
  context.add(example);

  const got = context.get(Example);

  expect(got).toBe(example);
})

it("will destroy modules created by layer", () => {
  class Test extends Model {
    didDestroy = jest.fn();

    null(){
      this.didDestroy();
      super.null();
    }
  }

  class Test1 extends Test {};
  class Test2 extends Test {};

  const context1 = new Context();
  const context2 = context1.push();

  const test1 = Test1.new();
  const test2 = context2.add(Test2);

  context2.add(test1);
  context2.pop();

  expect(test1.didDestroy).not.toBeCalled();
  expect(test2.didDestroy).toBeCalled();
})

describe("include", () => {
  class Foo extends Model {}
  class Bar extends Model {}
  class FooBar extends Model {
    foo = new Foo();
  }

  it("will register in batch", () => {
    const context = new Context();
    const foo = Foo.new();
    const bar = Bar.new();
  
    context.include({ foo, bar });
  
    expect(context.get(Foo)).toBe(foo);
    expect(context.get(Bar)).toBe(bar);
  })

  // This will be made more elegant later.
  it("will hard-reset if inputs differ", () => {
    const context = new Context();
    const foo = Foo.new();
    const bar = Bar.new();

    const bazEffect = jest.fn(() => bazDidDie);
    const bazDidDie = jest.fn();

    class Baz extends Model {
      constructor(){
        super();
        this.get(bazEffect);
      }
    }

    context.include({ foo, bar, Baz });

    const keyPriorUpdate = context.key;

    context.include({ foo, bar: Bar.new() });

    // key should change despite technically same layer.
    expect(context.key).not.toBe(keyPriorUpdate);

    // expect all instances did get replaced.
    expect(context.get(Bar)).not.toBe(bar);

    // expect Baz should have been force-replaced.
    expect(bazEffect).toBeCalledTimes(2);
    expect(bazDidDie).toBeCalled();
  })
  
  it("will register children implicitly", () => {
    const context = new Context();
    const foobar = FooBar.new();
  
    context.include({ foobar });
  
    expect(context.get(FooBar)).toBe(foobar);
    expect(context.get(Foo)).toBe(foobar.foo);
  })
  
  it("will prefer explicit over implicit", () => {
    const context = new Context();
    const foobar = FooBar.new();
    const foo = Foo.new();
    
    context.include({ foobar, foo });

    expect(context.get(FooBar)).toBe(foobar);
    expect(context.get(Foo)).not.toBe(foobar.foo);
    expect(context.get(Foo)).toBe(foo);
  })
})