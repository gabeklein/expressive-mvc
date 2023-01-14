import { Debug } from './debug';
import { Model } from './model';
import { mockConsole } from './testing';

describe("isTypeof", () => {
  class Test extends Model {}

  it("will assert if Model extends another", () => {
    class Test2 extends Test {}

    expect(Test.isTypeof(Test2)).toBe(true);
  })

  it("will be falsy if not super", () => {
    class NotATest extends Model {}

    expect(Model.isTypeof(NotATest)).toBe(true);
    expect(Test.isTypeof(NotATest)).toBe(false);
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
    expect(Debug.LOCAL).toBeDefined()
  })

  it("will expose instance controller", () => {
    const instance = FooBar.new() as Debug<FooBar>;
    const control = instance[Debug.CONTROL];

    expect(control).toBeDefined();
  })

  it("will expose instance state", () => {
    const instance = FooBar.new() as Debug<FooBar>;
    const exported = instance.export();
    const state = instance[Debug.STATE];

    expect(state).toMatchObject(exported);
  })

  it("will expose subscriber within listener", () => {
    const instance = FooBar.new() as Debug<FooBar>;

    expect(instance[Debug.LOCAL]).toBeUndefined();

    instance.on(local => {
      expect(local[Debug.CONTROL]).toBe(instance[Debug.CONTROL]);
      expect(local[Debug.LOCAL]).toBeDefined();
    })
  })
})

describe("LOCAL", () => {
  class Test extends Model {
    value1 = 1;
    value2 = 2;
    value3 = 3;
  }

  it("will reveal what values are in use", async () => {
    const test = Test.new() as Debug<Test>;

    test.on((local: Debug<Test>) => {
      void local.value1;
      void local.value3;

      const { using } = local[Debug.LOCAL]!;

      expect(using).toEqual(["value1", "value3"]);
    });
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

    const update = await test.on();
    const updated = test[Debug.UPDATE];

    expect(update).toStrictEqual(updated);

    expect(updated).toContain("value1");
    expect(updated).toContain("value2");
  })

  it("will reveal cause for update", async () => {
    const test = Test.new() as Debug<Test>;

    let update: readonly string[] | undefined;
    let fullUpdate: readonly string[] | false;

    test.on(state => {
      void state.value1;
      void state.value3;

      update = state[Debug.UPDATE];
    })

    expect(update).toBeUndefined();

    test.value1 = 2;
    test.value2 = 3;

    fullUpdate = await test.on();

    // sanity check
    expect(update).not.toStrictEqual(fullUpdate);
    expect(fullUpdate).toContain("value2");

    expect(update).toContain("value1");
    expect(update).not.toContain("value2");

    test.value3 = 4;

    fullUpdate = await test.on();

    // sanity check
    expect(fullUpdate).not.toContain("value1");

    expect(update).toContain("value3");
    expect(fullUpdate).toContain("value3");
  })
})

describe("toString", () => {
  class Test extends Model {};

  it("Model will cast to string as class name", () => {
    const test = Test.new();
    expect(String(test)).toBe("Test");
  })
})

describe("errors", () => {
  const { error } = mockConsole();

  it("will log update errors in the console", async () => {
    class Test extends Model {
      value = 1;
    };

    const expected = new Error("Goodbye cruel world!")
    const test = Test.new();

    test.on("value", () => {
      throw expected;
    });

    test.value = 2;

    await test.on();

    expect(error).toBeCalledWith(expected);
  });
})