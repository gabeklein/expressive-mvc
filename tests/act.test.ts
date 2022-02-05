import { Oops as Instruct } from '../src/instructions';
import { act, Model } from './adapter';

class Test extends Model {
  test = act(this.wait);
  nope = act(this.fail);

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
  const control = Test.create();
  const input = Symbol("unique");
  const output = control.test(input);
  
  await expect(output).resolves.toBe(input);
})

it("will set active to true for run-duration", async () => {
  const { test } = Test.create();

  expect(test.active).toBe(false);

  const result = test("foobar");
  expect(test.active).toBe(true);

  const output = await result;
  expect(output).toBe("foobar");
  expect(test.active).toBe(false);
})

it("will emit method key before/after activity", async () => {
  let update: readonly string[];
  const { test, get } = Test.create();

  expect(test.active).toBe(false);

  const result = test("foobar");
  update = await get.update(true);

  expect(test.active).toBe(true);
  expect(update).toContain("test");

  const output = await result;
  update = await get.update(true);

  expect(test.active).toBe(false);
  expect(update).toContain("test");
  expect(output).toBe("foobar");
})

it("will throw immediately if already in-progress", () => {
  const { test } = Test.create();
  const expected = Instruct.DuplicateAction("test");

  test();
  expect(() => test()).rejects.toThrowError(expected);
})

it("will throw and reset if action fails", async () => {
  const { nope, get } = Test.create();

  expect(nope.active).toBe(false);

  const result = nope();

  await get.update(true);
  expect(nope.active).toBe(true);

  await expect(result).rejects.toThrowError();
  expect(nope.active).toBe(false);
})

it("will complain if property is redefined", () => {
  const state = Test.create();
  const assign = () => state.test = 0 as any;

  expect(assign).toThrowError();
})