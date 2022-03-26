import { Oops as Assign } from '../src/assign';
import { Oops as Util } from '../src/util';
import { Model, set } from './adapter';

describe("optional", () => {
  it("will throw if set to undefined", () => {
    class Test extends Model {
      value = set(() => "foo");
    }

    const test = Test.create();
    const expected = Assign.NonOptional(test, "value");

    // @ts-ignore
    expect(() => test.value = undefined).toThrowError(expected);
    expect(() => test.value = "bar").not.toThrow();
  })

  it("will throw while required set to true", () => {
    class Test extends Model {
      value = set<string>(undefined, true);
    }

    const test = Test.create();
    const expected = Assign.NonOptional(test, "value");

    test.value = "foo";

    // @ts-ignore
    expect(() => test.value = undefined).toThrowError(expected);
    expect(() => test.value = "bar").not.toThrow();
  })

  it("will not throw if required value remains undefined", () => {
    class Test extends Model {
      value = set<string>(undefined, true);
    }

    const test = Test.create();

    // @ts-ignore
    expect(() => test.value = undefined).not.toThrowError();
    expect(() => test.value = "bar").not.toThrow();
  })

  it("will not throw while required set to false", () => {
    class Test extends Model {
      value = set(() => "bar", false);
    }

    const test = Test.create();

    expect(() => test.value = undefined).not.toThrow();
    expect(() => test.value = "foo").not.toThrow();
  })
})

describe("callback", () => {
  class Subject extends Model {
    didTrigger = jest.fn()
  
    test1 = set<number>(undefined, value => {
      this.didTrigger(value + 1);
    });
  
    test2 = set<number>(undefined, () => {
      return () => {
        this.didTrigger(true);
      }
    });
  
    test3 = set(() => "foo", value => {
      this.didTrigger(value);
    });

    test4 = set(() => "foo", value => {
      this.didTrigger(value);
      return false;
    });

    test5 = set(() => "foo", value => {
      this.didTrigger(value);
      return true;
    });
  }
  
  it('will invoke callback on property set', async () => {
    const state = Subject.create();
    const callback = jest.fn();
  
    expect(state.didTrigger).not.toBeCalled();
    state.once("test1", callback);

    state.test1 = 1;
    expect(state.didTrigger).toBeCalledWith(2);

    await state.update(true)
    expect(callback).toBeCalledWith(1, "test1");
  })
  
  it('will invoke return-callback on overwrite', async () => {
    const state = Subject.create();
  
    state.test2 = 1;

    await state.update(true);
    expect(state.didTrigger).not.toBeCalled();
    state.test2 = 2;

    await state.update(true);
    expect(state.didTrigger).toBeCalledWith(true);
  })
  
  it('will assign a default value', async () => {
    const state = Subject.create();
  
    expect(state.test3).toBe("foo");
    state.test3 = "bar";

    await state.update();
    expect(state.didTrigger).toBeCalledWith("bar");
  })

  it('will prevent update if callback returns false', async () => {
    const state = Subject.create();
  
    expect(state.test4).toBe("foo");
    state.test4 = "bar";

    await state.update(false);
    expect(state.didTrigger).toBeCalledWith("bar");
    expect(state.test4).toBe("foo");
  })

  it('will block value if callback returns true', async () => {
    const state = Subject.create();
  
    expect(state.test5).toBe("foo");
    state.test5 = "bar";

    await state.update(true);
    expect(state.test5).toBe("foo");
  })

  it('will ignore effect promise', () => {
    class Subject extends Model {
      property = set<any>(undefined, async () => {});
    }

    const state = Subject.create();

    expect(() => state.property = "bar").not.toThrow();
  })

  it('will throw on bad effect return', () => {
    class Subject extends Model {
      // @ts-ignore
      property = set<any>(undefined, () => 3);
    }

    const expected = Util.BadEffectCallback();
    const state = Subject.create();

    expect(() => state.property = "bar").toThrow(expected);
  })
})

describe("memoize", () => {
  const { error, warn } = console;

  afterAll(() => {
    console.warn = warn;
    console.error = error;
  });

  class Test extends Model {
    ranMemo = jest.fn();
    ranLazyMemo = jest.fn();

    memoized = set(() => {
      this.ranMemo();
      return "foobar";
    });

    memoLazy = set(() => {
      this.ranLazyMemo();
      return "foobar";
    }, false);
  }

  it("will run memoize on create", () => {
    const state = Test.create();

    expect(state.memoized).toBe("foobar");
    expect(state.ranMemo).toBeCalled();
  })

  it("will run only on access in lazy mode", () => {
    const state = Test.create();

    expect(state.ranLazyMemo).not.toBeCalled();

    expect(state.memoLazy).toBe("foobar");
    expect(state.ranLazyMemo).toBeCalled();
  })

  it("will warn and rethrow error from factory", () => {
    const warn = console.warn = jest.fn();

    class Test extends Model {
      memoized = set(() => {
        throw new Error("Foobar")
      })
    }

    const failed = Assign.FactoryFailed(Test.name, "memoized");
  
    expect(() => Test.create()).toThrowError("Foobar");
    expect(warn).toBeCalledWith(failed.message);
  })

  it("will throw on bad argument", () => {
    class Test extends Model {
      // @ts-ignore
      memoized = set("foobar");
    }

    const expected = Assign.BadFactory();

    expect(() => Test.create()).toThrowError(expected);
  })
})