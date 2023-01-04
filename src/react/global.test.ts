import { renderHook } from '@testing-library/react-hooks';

import { Global } from '..';
import { Oops } from './global';

describe("init", () => {
  class Test extends Global {
    value = 1;
  }

  afterEach(() => Test.reset());

  it("will access values from created global", () => {
    const hook = renderHook(() => Test.use());

    expect(hook.result.current.value).toBe(1);
  })

  it("will get an existing instance", () => {
    const instance = Test.create();

    expect(Test.get()).toBe(instance);
  })

  it("will throw if cannot get instance", () => {
    const expected = Oops.DoesNotExist(Test.name);

    expect(() => Test.get()).toThrowError(expected);
  })

  it("will return undefined if not initialized", () => {
    Test.create();
    expect(Test.get()).toBeDefined();

    Test.reset();
    expect(Test.get(false)).toBeUndefined();
  })

  it("will throw if Global does not exist", () => {
    const hook = renderHook(() => Test.tap());
    const expected = Oops.DoesNotExist(Test.name);

    expect(() => hook.result.current).toThrowError(expected);
  })

  it("will access values from found global", () => {
    Test.create();
    const rendered = renderHook(() => Test.get("value"));

    expect(rendered.result.current).toBe(1);
  })

  it("will complain already exists", () => {
    Test.create();
    const expected = Oops.AlreadyExists(Test.name);

    expect(() => Test.create()).toThrowError(expected);
  })
})

describe("update", () => {
  class Test extends Global {
    foo = 1;
    bar = 2;
  }

  afterEach(() => Test.reset());

  it("will update values on singleton instance", async () => {
    Test.create();

    expect(Test.get("foo")).toBe(1);
    expect(Test.get("bar")).toBe(2);

    const update = await Test.set({ foo: 2, bar: 1 });

    expect(update).toMatchObject(["foo", "bar"]);

    expect(Test.get("foo")).toBe(2);
    expect(Test.get("bar")).toBe(1);
  })
})