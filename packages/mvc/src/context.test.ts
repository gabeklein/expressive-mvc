import { Context, Oops } from './context';
import { Model } from './model';

class Example extends Model {};
class Example2 extends Example {};

it("will add instance to context", () => {
  const context = new Context();
  const example = new Example();

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

it("will complain if not found", () => {
  const context = new Context();
  const expected = Oops.NotFound(Example);
  const fetch = () => context.get(Example);

  expect(fetch).toThrowError(expected);
})

it("will return undefined if not found", () => {
  const context = new Context();
  const got = context.get(Example, false);

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
  const example = new Example();

  context.add(example);
  context.add(example);

  const got = context.get(Example);

  expect(got).toBe(example);
})

it("will return existing if key/value is same", () => {
  const context = new Context();
  const example1 = context.add(Example, "KEY");
  const example2 = context.add(Example, "KEY");

  expect(example1).toBe(example2);
})

it("will return existing if key/value is same", () => {
  const context = new Context();
  const example = Example.new();

  const example1 = context.add(example, "KEY");
  const example2 = context.add(example, "KEY");

  expect(example1).toBe(example2);
})

it("will destroy modules created by layer", () => {
  class Test extends Model {
    didDestroy = jest.fn();

    gc(){
      this.didDestroy();
      super.gc;
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