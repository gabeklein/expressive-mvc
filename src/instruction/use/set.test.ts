
import { Model } from "../..";
import { use } from "./use";

class Test extends Model {
  values = use(new Set());
}

it("will update on set", async () => {
  const test = Test.create();
  const mock = jest.fn();

  test.effect(($) => {
    mock($.values.has("hello"));
  })

  expect(mock).toBeCalledWith(false);

  test.values.add("hello");
  await test.update(true);

  expect(mock).toBeCalledWith(true);
})

it("will not update on unwatched key", async () => {
  const test = Test.create();
  const mock = jest.fn();

  test.effect($ => {
    mock($.values.has("hello"));
  })

  expect(mock).toBeCalledTimes(1);

  test.values.add("foo");
  await test.update(true);

  expect(mock).toBeCalledTimes(1);
})

it("will update for any key if iterated", async () => {
  const test = Test.create();
  const mock = jest.fn();

  test.effect($ => {
    mock([ ...$.values ]);
  })

  test.values.add("foo");
  await test.update(true);

  expect(mock).toBeCalledTimes(2);
})

it("will update on clear", async () => {
  const test = Test.create();
  const mock = jest.fn();

  test.effect($ => {
    mock($.values.has("hello"));
  })

  test.values.clear();
  await test.update(true);

  expect(mock).toBeCalledTimes(2);
})

it("will update on new value", async () => {
  const test = Test.create();
  const mock = jest.fn();

  test.effect($ => {
    mock($.values.has("hello"));
  })

  test.values = new Set();
  await test.update(true);

  expect(mock).toBeCalledTimes(2);
})

it("will update size for any change", async () => {
  const test = Test.create();
  const mock = jest.fn();

  test.effect($ => {
    mock($.values.size);
  })

  expect(mock).toBeCalledWith(0);

  test.values.add("foo");
  await test.update(true);

  expect(mock).toBeCalledWith(1);
})