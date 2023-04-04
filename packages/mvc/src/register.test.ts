import { Model } from "./model";
import { Oops, Register } from "./register";

class Example extends Model {};
class Example2 extends Example {};

it("will add instance to context", () => {
  const context = new Register();
  const example = new Example();

  context.add(example);

  expect(context.get(Example)).toBe(example);
})

it("will register all subtypes", () => {
  const context = new Register();
  const example2 = new Example2();

  context.add(example2);

  expect(context.get(Example2)).toBe(example2);
  expect(context.get(Example)).toBe(example2);
})

it("will create instance in context", () => {
  const context = new Register();

  context.add(Example);
  expect(context.get(Example)).toBeInstanceOf(Example);
})

it("will complain if not found", () => {
  const context = new Register();
  const expected = Oops.NotFound(Example);
  const fetch = () => context.get(Example);

  expect(fetch).toThrowError(expected);
})

it("will return undefined if not found", () => {
  const context = new Register();
  const got = context.get(Example, false);

  expect(got).toBeUndefined();
})

it("will complain if multiple registered", () => {
  const context = new Register();
  const expected = Oops.MultipleExist(Example);
  const fetch = () => context.get(Example);

  context.add(Example);
  context.add(Example);

  expect(fetch).toThrowError(expected);
})

it("will ignore if multiple but same", () => {
  const context = new Register();
  const example = new Example();

  context.add(example);
  context.add(example);

  const got = context.get(Example);

  expect(got).toBe(example);
})