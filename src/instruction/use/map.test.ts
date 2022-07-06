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
  test.destroy();
})

it("will allow normal methods outside proxy", () => {
  const { map } = Test.create();

  map.set("foo", "bar");
  expect(map.get("foo")).toBe("bar");
})

it("will squash simultaneous updates", async () => {
  const test = Test.create();
  const mock = jest.fn((state: Test) => {
    state.map.get("foo");
    state.map.has("bar");
  });

  test.effect(mock);

  test.map.set("foo", "bar");
  test.map.set("bar", "foo");
  await test.update(true);

  expect(mock).toBeCalledTimes(2);
})

it("will distrobute simultaneous updates", async () => {
  const test = Test.create();
  const mock1 = jest.fn(($: Test) => void $.map.has(1));
  const mock2 = jest.fn(($: Test) => void $.map.has(2));
  const mock3 = jest.fn(($: Test) => void $.map.has(3));

  test.effect(mock1);
  test.effect(mock2);
  test.effect(mock3);

  test.map.set(1, 1);
  test.map.set(2, 2);
  test.map.set(3, 3);

  await test.update();

  expect(mock1).toBeCalledTimes(2);
  expect(mock2).toBeCalledTimes(2);
  expect(mock3).toBeCalledTimes(2);
})

it("will update on delete", async () => {
  const test = Test.create();
  const mock = jest.fn((state: Test) => {
    state.map.get("foo");
    state.map.has("bar");
  });

  test.effect(mock);

  test.map.set("foo", "foo");
  test.map.set("bar", "bar");
  await test.update(true);

  test.map.delete("foo");
  test.map.delete("bar");
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

it("will update for any key where iterated", async () => {
  const test = Test.create();

  const mockIterator = jest.fn(({ map }: Test) => void [...map]);
  const mockValues = jest.fn(({ map }: Test) => void map.values());
  const mockKeys = jest.fn(({ map }: Test) => void map.keys());
  const mockEntries = jest.fn(({ map }: Test) => void map.entries());

  test.effect(mockIterator);
  test.effect(mockEntries);
  test.effect(mockValues);
  test.effect(mockKeys);

  test.map.set("foo", "bar");
  await test.update(true);

  expect(mockIterator).toBeCalledTimes(2);
  expect(mockEntries).toBeCalledTimes(2);
  expect(mockValues).toBeCalledTimes(2);
  expect(mockKeys).toBeCalledTimes(2);
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

  expect(mock).toBeCalledWith(0);

  test.map.set("foo", "bar");
  await test.update(true);

  expect(mock).toBeCalledWith(1);
})

it("will update size on full replacement", async () => {
  const test = Test.create();
  const mock = jest.fn();

  test.effect($ => {
    mock($.map.size);
  })

  expect(mock).toBeCalledWith(0);

  test.map = new Map([
    ["foo", "foo"],
    ["bar", "bar"]
  ])

  await test.update(true);

  expect(mock).toBeCalledWith(2);
})

it("will not memory-leak expired subscriber", async () => {
  const test = Test.create();
  const mock1 = jest.fn(($: Test) => void [ ...$.map ]);
  const mock2 = jest.fn(($: Test) => void [ ...$.map ]);

  const release1 = test.effect(mock1);
  const release2 = test.effect(mock2);

  expect(mock1).toBeCalledTimes(1);
  expect(mock2).toBeCalledTimes(1);

  test.map = new Map();
  await test.update(true);

  expect(mock1).toBeCalledTimes(2);
  expect(mock2).toBeCalledTimes(2);

  release1();
  test.map = new Map();
  await test.update(true);

  expect(mock1).toBeCalledTimes(2);
  expect(mock2).toBeCalledTimes(3);

  release2();
})