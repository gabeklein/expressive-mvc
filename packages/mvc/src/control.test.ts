import { Control, LIFECYCLE } from './control';
import { set } from './instruction/set';
import { add, Model } from './model';
import { mockError } from './tests/mocks';

describe("instruction", () => {
  class Test extends Model {
    didRunInstruction = jest.fn();
    didRunGetter = jest.fn();

    property = add((key) => {
      this.didRunInstruction(key);

      return () => {
        this.didRunGetter(key);
      }
    })
  }

  it("will use symbol as placeholder", () => {
    const { property } = new Test();
    const { description } = property as any;

    expect(typeof property).toBe("symbol");
    expect(description).toBe("instruction");
  })

  it("will run instruction on create", () => {
    const { didRunInstruction: ran } = Test.new();

    expect(ran).toBeCalledWith("property");
  })

  it("will run instruction getter upon access", async () => {
    const instance = Test.new();
    const ran = instance.didRunGetter;

    instance.get($ => void $.property);

    expect(ran).toBeCalledWith("property");

    void instance.property;

    expect(ran).toBeCalledTimes(2);
  })

  it("will ignore normal symbol", () => {
    class Test extends Model {
      value = Symbol("hello");
    }
    
    const test = Test.new();

    expect(typeof test.value).toBe("symbol");
  })

  describe("set", () => {
    it("will prevent update if returns false", async () => {
      const didSetValue = jest.fn((newValue) => {
        if(newValue == "ignore")
          return false;
      });
  
      class Test extends Model {
        property = add(() => {
          return {
            value: "foobar",
            set: didSetValue
          }
        })
      }
  
      const test = Test.new();
  
      expect(test.property).toBe("foobar");
  
      test.property = "test";
      expect(didSetValue).toBeCalledWith("test", "foobar");
      expect(test.property).toBe("test");
      await expect(test).toUpdate();
  
      test.property = "ignore";
      expect(didSetValue).toBeCalledWith("ignore", "test");
      expect(test.property).toBe("test");
      await expect(test).not.toUpdate();
    })
  
    // duplicate test?
    it("will revert update if returns false", async () => {
      let ignore = false;

      class Test extends Model {
        property = add(() => {
          return {
            value: 0,
            set: (value) => ignore
              ? false
              : () => value + 10
          }
        })
      }
  
      const instance = Test.new();
  
      expect(instance.property).toBe(0);
  
      instance.property = 10;
      expect(instance.property).toBe(20);
      await expect(instance).toUpdate();

      ignore = true;

      instance.property = 0;
      expect(instance.property).toBe(20);
      await expect(instance).not.toUpdate();
    })

    it("will not duplicate explicit update", () => {
      class Test extends Model {
        property = add<string>(() => ({
          value: "foobar",
          set: (value) => () => value + "!"
        }))
      }

      const test = Test.new();
      const didUpdate = jest.fn();

      test.set(didUpdate);

      expect(test.property).toBe("foobar");

      test.property = "test";

      expect(test.property).toBe("test!");
      expect(didUpdate).toBeCalledTimes(1);
    })

    it.skip("will not update on reassignment", () => {
      class Test extends Model {
        property = add<string>((key) => ({
          value: "foobar",
          set: (value: any) => {
            (this as any)[key] = value + "!";
          }
        }))
      }

      const test = Test.new();
      const didUpdate = jest.fn();

      test.set(didUpdate);

      expect(test.property).toBe("foobar");

      test.property = "test";

      expect(test.property).toBe("test!");
      expect(didUpdate).toBeCalledTimes(1);
    })
  })

  it("will run getter upon access", () => {
    const mockAccess = jest.fn((_subscriber) => "foobar");
    const mockApply = jest.fn((_key) => mockAccess);

    class Test extends Model {
      property = add(mockApply);
    }

    const instance = Test.new();

    expect(mockApply).toBeCalledWith(
      "property", expect.any(Control)
    );
    expect(mockAccess).not.toBeCalled();
    expect(instance.property).toBe("foobar");
    expect(mockAccess).toBeCalledWith(instance);
  })

  it("will pass subscriber if within one", () => {
    const didGetValue = jest.fn();

    class Test extends Model {
      property = add(() => didGetValue)
    }

    const state = Test.new();

    state.get(own => {
      void own.property;
    });

    expect(didGetValue).toBeCalledWith(state);
  });
})

it("will call dispatch callbacks", async () => {
  const didUpdate = jest.fn();
  const willUpdate = jest.fn();

  LIFECYCLE.update.add(willUpdate);
  LIFECYCLE.didUpdate.add(didUpdate);

  class Test extends Model {
    value = 1;
  }

  const test = Test.new();

  test.value += 1;
  await expect(test).toUpdate();

  expect(willUpdate).toBeCalledTimes(1);
  expect(didUpdate).toBeCalledTimes(1);

  LIFECYCLE.update.delete(willUpdate);
  LIFECYCLE.didUpdate.delete(didUpdate);
})

it("will run effect after properties", () => {
  const mock = jest.fn();

  class Test extends Model {
    property = add((_key, control) => {
      this.get(() => {
        mock(control.state);
      })
    })

    foo = 1;
    bar = 2;
  }

  Test.new();

  expect(mock).toBeCalledWith({
    foo: 1,
    bar: 2
  });
})

describe("suspense", () => {
  it("will seem to throw error outside react", () => {
    class Test extends Model {
      value = set<never>();
    }
  
    const instance = Test.new("ID");
    let didThrow: Error | undefined;
  
    try {
      void instance.value;
    }
    catch(err: any){
      didThrow = err;
    }
  
    expect(String(didThrow)).toMatchInlineSnapshot(`"Error: Test-ID.value is not yet available."`);
  })
  
  it("will reject if model destroyed before resolved", async () => {
    class Test extends Model {
      value = set<never>();
    }
  
    const instance = Test.new("ID");
    let didThrow: Promise<any> | undefined;
  
    try {
      void instance.value;
    }
    catch(err: any){
      didThrow = err;
    }
  
    instance.null();
  
    await expect(didThrow).rejects.toThrowError(`Test-ID is destroyed.`);
  })
})

describe("errors", () => {
  const error = mockError();

  it("will throw sync error to the console", async () => {
    class Test extends Model {
      value = 1;
    };

    const test = Test.new();

    test.set(() => {
      throw new Error("sync error");
    });

    const attempt = () => test.value = 2;

    expect(attempt).toThrowError(`sync error`);
  });

  it("will log async error to the console", async () => {
    class Test extends Model {
      value = 1;
    };

    const expected = new Error("async error")
    const test = Test.new();

    test.get($ => {
      if($.value == 2)
        throw expected;
    })

    test.value = 2;

    await test.set(0);

    expect(error).toBeCalledWith(expected);
  });
})