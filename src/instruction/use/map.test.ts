import { Model } from "../..";
import { use } from "./use";

class Test extends Model {
  map = use(new Map());
}

it("will update on set", async () => {
  const test = Test.create();
  const mock = jest.fn((state: Test) => {
    state.map.get("foo");
    state.map.has("bar");
  });

  test.effect(mock);

  test.map.set("foo", "bar");
  await test.update(true);

  test.map.set("bar", "foo");
  await test.update(true);

  expect(mock).toBeCalledTimes(3);
})

it("will not update on unwatched key", async () => {
  const test = Test.create();
  const mock = jest.fn();

  test.effect($ => {
    mock($.map.get("hello"));
  })

  test.map.set("foo", "false");
  await test.update(true);

  expect(mock).toBeCalledTimes(1);
})

it("will update for any key if iterated", async () => {
  const test = Test.create();
  const mock = jest.fn();

  test.effect($ => {
    mock([ ...$.map ]);
  })

  test.map.set("foo", "bar");
  await test.update(true);

  expect(mock).toBeCalledTimes(2);

})

it("will update on clear", async () => {
  const test = Test.create();
  const mock = jest.fn();

  test.effect($ => {
    mock($.map.get("hello"));
  })

  test.map.clear();
  await test.update(true);

  expect(mock).toBeCalledTimes(2);
})

it("will update on new value", async () => {
  const test = Test.create();
  const mock = jest.fn();

  test.effect($ => {
    mock($.map.get("hello"));
  })

  test.map = new Map();
  await test.update(true);

  expect(mock).toBeCalledTimes(2);
})

it("will update size for any change", async () => {
  const test = Test.create();
  const mock = jest.fn();

  test.effect($ => {
    mock($.map.size);
  })

  test.map = new Map();

  expect(mock).toBeCalledWith(0);

  test.map.set("foo", "bar");
  await test.update(true);

  expect(mock).toBeCalledWith(1);

})