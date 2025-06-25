import { createEffect, Observable } from './control';
import { set } from './instruction/set';
import { use } from './instruction/use';
import { mockError } from './mocks';
import { Model } from './model';

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
      createEffect(test, $ => {
        expect<string>($.property);
      }, true);
    }

    expect(attempt).toThrowError(`ID.property is required in this context.`);
  });

  it("will still get events after silent ones", async () => {
    class Test extends Model {
      value1 = 1;
      value2 = 2;
    }
  
    const test = Test.new();
    const didGetValue = jest.fn();
  
    test.get($ => {
      didGetValue($.value1, $.value2);
    });
  
    expect(didGetValue).toBeCalledWith(1, 2);
  
    test.set({ value1: 10 }, true);
    test.set({ value2: 20 });
  
    await expect(test).toHaveUpdated();
  
    expect(didGetValue).toBeCalledWith(10, 20);
    expect(didGetValue).toBeCalledTimes(2);
  });

  it("will cleanup nested effects", async () => {
    class Test extends Model {
      foo = 1;
      bar = 2;
    }
  
    const test = Test.new();
    const didInvoke = jest.fn();
  
    const done = createEffect(test, ({ foo }) => {
      createEffect(test, ({ bar }) => {
        didInvoke({ foo, bar });
      });
    });

    expect(didInvoke).toBeCalledTimes(1);
    expect(didInvoke).toBeCalledWith({ foo: 1, bar: 2 });

    await test.set({ bar: 3 });

    expect(didInvoke).toBeCalledWith({ foo: 1, bar: 3 });
  
    await test.set({ foo: 2, bar: 4 });

    expect(didInvoke).toBeCalledWith({ foo: 2, bar: 4 });
    expect(didInvoke).not.toBeCalledWith({ foo: 1, bar: 4 });

    await test.set({ bar: 2 });

    expect(didInvoke).toBeCalledWith({ foo: 2, bar: 2 });

    done();

    await test.set({ bar: 1 });

    expect(didInvoke).not.toBeCalledWith({ foo: 2, bar: 1 });
    expect(didInvoke).toBeCalledTimes(4);
  })
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

describe("proxy", () => {
  it("will create a proxy object", () => {
    class Test extends Model {
      foo = 1;
      bar = 2;
      baz = 3;
    }

    const test = Test.new("Test");
    const getter = jest.fn((
      self: Model,
      key: string | number | symbol,
      value: unknown): string => {

      if(typeof key == "symbol")
        key = key.description || "symbol";
  
      return `${self}.${key}=${value}`;
    });
  
    const proxy = test[Observable](getter);

    expect(proxy.foo).toBe(`Test.foo=1`);
    expect(getter).toBeCalledWith(test, "foo", 1);

    expect(proxy.bar).toBe(`Test.bar=2`);
    expect(getter).toBeCalledWith(test, "bar", 2);

    expect(proxy.baz).toBe(`Test.baz=3`);
    expect(getter).toBeCalledWith(test, "baz", 3);

    expect(getter).toBeCalledTimes(3);
  })
})