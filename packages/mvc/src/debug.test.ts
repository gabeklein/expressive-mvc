import { Debug } from './debug';
import { Model } from './model';
import { mockError } from './helper/testing';

describe("is", () => {
  class Test extends Model {}

  it("will assert if Model extends another", () => {
    class Test2 extends Test {}

    expect(Test.is(Test2)).toBe(true);
  })

  it("will be falsy if not super", () => {
    class NotATest extends Model {}

    expect(Model.is(NotATest)).toBe(true);
    expect(Test.is(NotATest)).toBe(false);
  })
})

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
      child = new Child();
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

  it.skip("will reveal cause for update", async () => {
    const test = Test.new() as Debug<Test>;

    let update: Model.Values<Test> | undefined;
    let fullUpdate: Model.Values<Test> | false;

    test.get(state => {
      void state.value1;
      void state.value3;

      update = state[Debug.UPDATE];
    })

    expect(update).toBeUndefined();

    test.value1 = 2;
    test.value2 = 3;

    fullUpdate = await test.set(0);

    // sanity check
    expect(update).not.toStrictEqual(fullUpdate);
    expect(fullUpdate).toContain("value2");

    expect(update).toContain("value1");
    expect(update).not.toContain("value2");

    test.value3 = 4;

    fullUpdate = await test.set(0);

    // sanity check
    expect(fullUpdate).not.toContain("value1");

    expect(update).toContain("value3");
    expect(fullUpdate).toContain("value3");
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

  it.skip("will log update errors in the console", async () => {
    class Test extends Model {
      value = 1;
    };

    const expected = new Error("Goodbye cruel world!")
    const test = Test.new();

    test.get(() => {
      throw expected;
    })

    test.value = 2;

    await test.set(0);

    expect(error).toBeCalledWith(expected);
  });
})