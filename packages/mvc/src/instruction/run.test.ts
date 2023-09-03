import { Model } from '../model';
import { run } from './run';
import { set } from './set';

class Test extends Model {
  test = run(this.wait);
  nope = run(this.fail);

  async wait<T>(input?: T){
    return new Promise<T | undefined>(res => {
      setTimeout(() => res(input), 1)
    });
  }

  async fail(){
    await new Promise(r => setTimeout(r, 1));
    throw new Error("Nope");
  }
}

it("will pass arguments to wrapped function", async () => {
  const control = Test.new();
  const input = Symbol("unique");
  const output = control.test(input);

  await expect(output).resolves.toBe(input);
})

it("will set active to true for run-duration", async () => {
  const { test } = Test.new();

  expect(test.active).toBe(false);

  const result = test("foobar");
  expect(test.active).toBe(true);

  const output = await result;
  expect(output).toBe("foobar");
  expect(test.active).toBe(false);
})

it("will emit method key before/after activity", async () => {
  let update: Model.Values<Test> | false;
  const is = Test.new();

  expect(is.test.active).toBe(false);

  const result = is.test("foobar");
  update = await is.set(0);

  expect(is.test.active).toBe(true);
  expect(update).toHaveProperty("test");

  const output = await result;
  update = await is.set(0);

  expect(is.test.active).toBe(false);
  expect(update).toHaveProperty("test");
  expect(output).toBe("foobar");
})

it("will throw immediately if already in-progress", async () => {
  const { test } = Test.new();

  test();
  await expect(() => test()).rejects.toThrowError(`Invoked action test but one is already active.`);
})

it("will throw and reset if action fails", async () => {
  const test = Test.new();

  expect(test.nope.active).toBe(false);

  const result = test.nope();

  await expect(test).toUpdate();
  expect(test.nope.active).toBe(true);

  await expect(result).rejects.toThrowError();
  expect(test.nope.active).toBe(false);
})

it("will complain if property is redefined", () => {
  const state = Test.new();
  const assign = () => state.test = 0 as any;

  expect(assign).toThrowError();
})

it("will internally retry on suspense", async () => {
  class Test extends Model {
    value = set<string>();

    getValue = run(async () => {
      didInvoke();
      return this.value;
    })
  }

  const didInvoke = jest.fn();
  const test = Test.new();
  const value = test.getValue();

  expect(didInvoke).toBeCalled();
  await expect(test).toUpdate();

  test.value = "foobar";

  await expect(value).resolves.toBe("foobar");
  await expect(test).toUpdate();

  expect(didInvoke).toBeCalledTimes(2);
})