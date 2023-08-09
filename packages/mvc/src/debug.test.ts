import { Debug } from './debug';
import { mockError } from './helper/mocks';
import { use } from './instruction/use';
import { Model } from './model';

describe("Symbols", () => {
  class FooBar extends Model {
    foo = "foo";
    bar = "bar";
  }

  it("will be defined", () => {
    expect(Debug.CONTROL).toBeDefined()
    expect(Debug.STATE).toBeDefined()
  })

  it("will expose instance controller", () => {
    const instance = FooBar.new() as Debug<FooBar>;
    const control = instance[Debug.CONTROL];

    expect(control).toBeDefined();
  })

  it("will expose instance state", () => {
    const instance = FooBar.new() as Debug<FooBar>;
    const exported = instance.get();
    const state = instance[Debug.STATE];

    expect(state).toMatchObject(exported);
  })
})

describe("PARENT", () => {
  it("will return immediate parent of Model", () => {
    class Child extends Model {}
    class Parent extends Model {
      child = use(Child);
    }

    const parent = Parent.new();
    const child = parent.child as Debug<Child>;
    
    expect(child[Debug.PARENT]).toBe(parent);
  })
})

describe("UPDATE", () => {
  class Test extends Model {
    value1 = 1;
    value2 = 2;
    value3 = 3;
  }

  it("will reveal last update", async () => {
    const test = Test.new() as Debug<Test>;

    test.value1 = 2;
    test.value2 = 3;

    const update = await test.set(0);
    const updated = test[Debug.UPDATE];

    expect(update).toBe(updated);
    expect(updated).toEqual({ value1: 2, value2: 3 });
  })
})

describe("toString", () => {
  it("will output a unique ID", () => {
    const a = String(Model.new());
    const b = String(Model.new());

    expect(a).not.toBe(b);
  })

  it("will use user-defined ID", () => {
    const a = String(Model.new("ID"));
    const b = String(Model.new("ID"));

    expect(a).toBe(b);
  })

  it("will be class name and 6 random characters", () => {
    class FooBar extends Model {}

    const foobar = String(FooBar.new());

    expect(foobar).toMatch(/^FooBar-\w{6}/)
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