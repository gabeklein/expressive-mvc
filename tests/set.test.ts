import { Model, set } from '../src';
import { Oops as Assign } from '../src/instruction/set';
import { Oops as Util } from '../src/util';

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
  it('will invoke callback on property set', async () => {
    class Subject extends Model {
      test = set<number>(undefined, value => {
        callback(value + 1);
      });
    }

    const state = Subject.create();
    const callback = jest.fn()
    const event = jest.fn();
  
    expect(callback).not.toBeCalled();
    state.once("test", event);

    state.test = 1;
    expect(callback).toBeCalledWith(2);

    await state.update(true)
    expect(event).toBeCalledWith(1, "test");
  })
  
  it('will invoke return-callback on overwrite', async () => {
    class Subject extends Model {
      test = set<number>(undefined, () => {
        return () => {
          callback(true);
        }
      });
    }
    
    const callback = jest.fn()
    const state = Subject.create();
  
    state.test = 1;

    await state.update(true);
    expect(callback).not.toBeCalled();
    state.test = 2;

    await state.update(true);
    expect(callback).toBeCalledWith(true);
  })
  
  it('will assign a default value', async () => {
    class Subject extends Model {
      test = set(() => "foo", value => {
        callback(value);
      });
    }
    
    const callback = jest.fn()
    const state = Subject.create();
  
    expect(state.test).toBe("foo");
    state.test = "bar";

    await state.update();
    expect(callback).toBeCalledWith("bar");
  })

  it('will prevent update if callback returns false', async () => {
    class Subject extends Model {
      test = set(() => "foo", value => {
        callback(value);
        return false;
      });
    }
    
    const callback = jest.fn()
    const state = Subject.create();
  
    expect(state.test).toBe("foo");
    state.test = "bar";

    await state.update(false);
    expect(callback).toBeCalledWith("bar");
    expect(state.test).toBe("foo");
  })

  it('will block value if callback returns true', async () => {
    class Subject extends Model {
      test = set(() => "foo", value => true);
    }
  
    const state = Subject.create();
  
    expect(state.test).toBe("foo");
    state.test = "bar";

    await state.update(true);
    expect(state.test).toBe("foo");
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