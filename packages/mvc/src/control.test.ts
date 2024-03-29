import { effect } from './control';
import { set } from './instruction/set';
import { use } from './instruction/use';
import { mockError } from './mocks';
import { Model } from './model';

describe("instruction", () => {
  class Test extends Model {
    didRunInstruction = jest.fn();
    didRunGetter = jest.fn();

    property = use((key) => {
      this.didRunInstruction(key);

      return () => {
        this.didRunGetter(key);
      }
    })
  }

  it("will use symbol as placeholder", () => {
    const { property } = new Test();
    const { description } = property;

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
        property = use(() => {
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
      await expect(test).toHaveUpdated();
  
      test.property = "ignore";
      expect(didSetValue).toBeCalledWith("ignore", "test");
      expect(test.property).toBe("test");
      await expect(test).not.toHaveUpdated();
    })
  
    // duplicate test?
    it("will revert update if returns false", async () => {
      let ignore = false;

      class Test extends Model {
        property = use(() => {
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
      await expect(instance).toHaveUpdated();

      ignore = true;

      instance.property = 0;
      expect(instance.property).toBe(20);
      await expect(instance).not.toHaveUpdated();
    })

    it("will not duplicate explicit update", () => {
      class Test extends Model {
        property = use<string>(() => ({
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

    it("will not update on reassignment", () => {
      class Test extends Model {
        property = use<string>((key) => ({
          value: "foobar",
          set: (value: any) => {
            return () => value + "!";
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
      property = use(mockApply);
    }

    const instance = Test.new();

    expect(mockApply).toBeCalledWith("property", expect.any(Test), {});
    expect(mockAccess).not.toBeCalled();
    expect(instance.property).toBe("foobar");
    expect(mockAccess).toBeCalledWith(instance);
  })

  it("will pass subscriber if within one", () => {
    const didGetValue = jest.fn();

    class Test extends Model {
      property = use(() => didGetValue)
    }

    const state = Test.new();

    state.get(own => {
      void own.property;
    });

    expect(didGetValue).toBeCalledWith(state);
  });
})

describe("effect", () => {
  it("will run after properties", () => {
    const mock = jest.fn();
  
    class Test extends Model {
      property = use((_key, _model, state) => {
        this.get(() => mock(state))
      })
  
      foo = 1;
      bar = 2;
    }
  
    Test.new();
  
    expect(mock).toBeCalledWith({ foo: 1, bar: 2 });
  });

  it("will enforce values if required", () => {
    class Test extends Model {
      property?: string = undefined;
    }

    const test = Test.new("ID");
    const attempt = () =>  {
      effect(test, $ => {
        expect<string>($.property);
      }, true);
    }

    expect(attempt).toThrowError(`ID.property is required in this context.`);
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
  
    expect(String(didThrow)).toMatchInlineSnapshot(`"Error: ID.value is not yet available."`);
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
  
    instance.set(null);
  
    await expect(didThrow).rejects.toThrowError(`ID is destroyed.`);
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

    await expect(test).toHaveUpdated();

    expect(error).toBeCalledWith(expected);
  });
})