
import { Model } from "../..";
import { from } from "../from";
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

it("will distrobute simultaneous updates", async () => {
  const test = Test.create();
  const mock1 = jest.fn(($: Test) => void $.values.has(1));
  const mock2 = jest.fn(($: Test) => void $.values.has(2));
  const mock3 = jest.fn(($: Test) => void $.values.has(3));

  test.effect(mock1);
  test.effect(mock2);
  test.effect(mock3);

  test.values.add(1);
  test.values.add(2);
  test.values.add(3);

  await test.update();

  expect(mock1).toBeCalledTimes(2);
  expect(mock2).toBeCalledTimes(2);
  expect(mock3).toBeCalledTimes(2);
})

it("will allow normal methods outside proxy", () => {
  const { values } = Test.create();

  values.add("foo");
  expect(values.has("foo")).toBe(true);
})

it("will update on delete", async () => {
  const test = Test.create();
  const mock = jest.fn((state: Test) => {
    state.values.has("foo");
  });

  test.effect(mock);

  test.values.add("foo");
  await test.update(true);

  test.values.delete("foo");
  await test.update(true);

  expect(mock).toBeCalledTimes(3);
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

it("will update for any where iterated", async () => {
  const test = Test.create();

  const mockIterator = jest.fn(({ values }: Test) => void [...values]);
  const mockValues = jest.fn(({ values }: Test) => void values.values());
  const mockKeys = jest.fn(({ values }: Test) => void values.keys());
  const mockEntries = jest.fn(({ values }: Test) => void values.entries());

  test.effect(mockIterator);
  test.effect(mockEntries);
  test.effect(mockValues);
  test.effect(mockKeys);

  test.values.add("foo");
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
    mock($.values.has("hello"));
  })

  test.values.clear();
  await test.update(true);

  expect(mock).toBeCalledTimes(2);
})

it("will update any key on replacement", async () => {
  const test = Test.create();
  const mock = jest.fn();

  test.effect($ => {
    mock($.values.has("hello"));
  })

  test.values = new Set();
  await test.update(true);

  expect(mock).toBeCalledTimes(2);
})

describe("size", () => {
  it("will update for any change", async () => {
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

  it("will update on replacement", async () => {
    const test = Test.create();
    const mock = jest.fn();
  
    test.effect($ => {
      mock($.values.size);
    })
  
    expect(mock).toBeCalledWith(0);
  
    test.values = new Set(["foo", "bar"])
    await test.update(true);
  
    expect(mock).toBeCalledWith(2);
  })
})

describe("computed", () => {
  it("will trigger", async () => {
    class Test extends Model {
      values = use(new Set());
      size = from(this, $ => $.values.size);
    }
  
    const test = Test.create();
    const mock = jest.fn();
  
    test.effect($ => mock($.size));
  
    expect(mock).toBeCalledWith(0);
  
    test.values.add("foo");
    await test.update(true);
  
    expect(mock).toBeCalledTimes(2)
    expect(mock).toBeCalledWith(1);
  })
  
  it("will supress non-applicable", async () => {
    class Test extends Model {
      values = use(new Set());
      size = from(this, $ => $.values.has("bar"));
    }
  
    const test = Test.create();
    const mock = jest.fn();
  
    test.effect($ => mock($.size));
  
    expect(mock).toBeCalledWith(false);
  
    test.values.add("foo");
    await test.update(true);

    expect(mock).toBeCalledTimes(1);
  })
})