import { assertDidUpdate } from '../helper/testing';
import { Model } from '../model';
import { get } from './get';
import { map } from './map';

it.only("will skip all tests", () => {});

describe("Map", () => {
  class Test extends Model {
    map = map();
  }

  it("will update on set", async () => {
    const test = Test.new();
    const mock = jest.fn();

    test.map.set("foo", "foo");
  
    test.on($ => {
      mock($.map.get("foo"));
    });

    expect(mock).toBeCalledWith("foo");
  
    test.map.set("foo", "bar");
    await assertDidUpdate(test);
  
    expect(mock).toBeCalledTimes(2);
    expect(mock).toBeCalledWith("bar");
  })
})

class Test extends Model {
  values = map();
  size = get(this, $ => $.values.size);
}

it("contains reference to original", () => {
  const test = Test.new();

  expect(test.values.from).toBeInstanceOf(Map);
})

it("will augment forEach to return filtered map", () => {
  const { is: test, values } = Test.new();
  
  for(const x of [1, 2, 3, 4, 5])
    test.values.set(x, x);

  const numbers = values.forEach((x: number) => x);
  const even = values.forEach((x: number) => {
    if(x % 2 == 0)
      return x;
  });

  expect(numbers).toMatchObject([1, 2, 3, 4, 5]);
  expect(even).toMatchObject([2, 4]);
})

it("will update on add", async () => {
  const test = Test.new();
  const mock = jest.fn();

  test.on(($) => {
    mock($.values.has("foo"));
  })

  expect(mock).toBeCalledWith(false);

  test.values.set("foo", true);
  await assertDidUpdate(test);

  expect(mock).toBeCalledWith(true);
  test.gc();
})

it("will not update for unwatched", async () => {
  const test = Test.new();
  const mock = jest.fn(($: Test) => {
    void $.values.has("foo");
  });

  test.on(mock);

  expect(mock).toBeCalledTimes(1);

  test.values.set("bar", true);
  await assertDidUpdate(test);

  expect(mock).toBeCalledTimes(1);
})

it("will update on delete", async () => {
  const test = Test.new();
  const mock = jest.fn(($: Test) => void $.values.has("foo"));

  test.on(mock);

  test.values.set("foo", true);
  await assertDidUpdate(test);

  test.values.delete("foo");
  await assertDidUpdate(test);

  expect(mock).toBeCalledTimes(3);
})

it("will update on clear", async () => {
  const test = Test.new();
  const mock = jest.fn(($: Test) => void $.values.has("foo"));

  test.on(mock)

  test.values.clear();
  await assertDidUpdate(test);

  expect(mock).toBeCalledTimes(2);
})

it("will update any key where iterated", async () => {
  const test = Test.new();

  const mockIterator = jest.fn(({ values }: Test) => void [...values]);
  const mockValues = jest.fn(({ values }: Test) => void values.values());
  const mockKeys = jest.fn(({ values }: Test) => void values.keys());
  const mockEntries = jest.fn(({ values }: Test) => void values.entries());

  test.on(mockIterator);
  test.on(mockEntries);
  test.on(mockValues);
  test.on(mockKeys);

  test.values.set("foo", true);
  await assertDidUpdate(test);

  expect(mockIterator).toBeCalledTimes(2);
  expect(mockEntries).toBeCalledTimes(2);
  expect(mockValues).toBeCalledTimes(2);
  expect(mockKeys).toBeCalledTimes(2);
})

it("will update any key where not accessed", () => {
  const test = Test.new();
  const mock = jest.fn(($: Test) => void $.values);

  test.on(mock);
})

it("will update any key on replacement", async () => {
  const test = Test.new();
  const mock = jest.fn(($: Test) => void $.values.has("foo"));

  test.on(mock);

  test.values = new Map();

  await assertDidUpdate(test);

  expect(mock).toBeCalledTimes(2);
})

it("will update size on replacement", async () => {
  const test = Test.new();
  const mock = jest.fn(($: Test) => void $.values.size);

  test.on(mock);

  test.values = new Map();

  await assertDidUpdate(test);

  expect(mock).toBeCalledTimes(2);
})

it("will squash multiple updates", async () => {
  const test = Test.new();
  const mock = jest.fn((state: Test) => {
    state.values.has("foo");
    state.values.has("bar");
  });

  test.on(mock);

  test.values.set("foo", true);
  test.values.set("bar", true);
  await assertDidUpdate(test);

  expect(mock).toBeCalledTimes(2);
})

it("will spread multiple updates", async () => {
  const test = Test.new();
  const mock1 = jest.fn(($: Test) => void $.values.has(1));
  const mock2 = jest.fn(($: Test) => void $.values.has(2));
  const mock3 = jest.fn(($: Test) => void $.values.has(3));

  test.on(mock1);
  test.on(mock2);
  test.on(mock3);

  test.values.set(1, true);
  test.values.set(2, true);
  test.values.set(3, true);

  await test.on();

  expect(mock1).toBeCalledTimes(2);
  expect(mock2).toBeCalledTimes(2);
  expect(mock3).toBeCalledTimes(2);
})

it("will allow normal methods outside proxy", () => {
  const test = Test.new();

  test.values.set("foo", true);
  expect(test.values.has("foo")).toBe(true);
})

it("will not update a stopped subscriber", async () => {
  const test = Test.new();
  const mock1 = jest.fn(($: Test) => void $.values);
  const mock2 = jest.fn(($: Test) => void $.values);

  const release1 = test.on(mock1);
  const release2 = test.on(mock2);

  expect(mock1).toBeCalledTimes(1);
  expect(mock2).toBeCalledTimes(1);

  test.values = new Map();
  await assertDidUpdate(test);

  expect(mock1).toBeCalledTimes(2);
  expect(mock2).toBeCalledTimes(2);

  release1();
  test.values = new Map();
  await assertDidUpdate(test);

  expect(mock1).toBeCalledTimes(2);
  expect(mock2).toBeCalledTimes(3);

  release2();
})

it("will update size for any change", async () => {
  const test = Test.new();
  const mock = jest.fn();

  test.on($ => {
    mock($.values.size);
  })

  expect(mock).toBeCalledWith(0);

  test.values.set("foo", true);
  await assertDidUpdate(test);

  expect(mock).toBeCalledWith(1);
})

it("will update computed for used keys", async () => {
  const test = Test.new();
  const mock = jest.fn();

  test.on($ => mock($.size));

  expect(mock).toBeCalledWith(0);

  test.values.set("foo", true);
  await assertDidUpdate(test);

  expect(mock).toBeCalledTimes(2)
  expect(mock).toBeCalledWith(1);
})

it("will update computed for used keys only", async () => {
  class Test extends Model {
    values = map();
    size = get(this, $ => $.values.has("bar"));
  }

  const test = Test.new();
  const mock = jest.fn();

  test.on($ => mock($.size));

  expect(mock).toBeCalledWith(false);

  test.values.set("foo", true);
  await assertDidUpdate(test);

  expect(mock).toBeCalledTimes(1);
})