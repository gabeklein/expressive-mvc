import { Model } from '../src';
import { CONTROL, LOCAL, STATE, WHY } from '../src/model';

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
    expect(CONTROL).toBeDefined()
    expect(STATE).toBeDefined()
    expect(LOCAL).toBeDefined()
  })

  it("will expose instance controller", () => {
    const instance = FooBar.create();
    const controller = instance[CONTROL];

    expect(controller).toBeDefined();
  })

  it("will expose instance state", () => {
    const instance = FooBar.create();
    const exported = instance.export();
    const state = instance[STATE];

    expect(state).toMatchObject(exported);
  })

  it("will expose subscriber within listener", () => {
    const instance = FooBar.create();

    expect(instance[LOCAL]).toBeUndefined();

    instance.effect(local => {
      expect(local[CONTROL]).toBe(instance[CONTROL]);
      expect(local[LOCAL]).toBeDefined();
    })
  })
})

describe("WHY", () => {
  class Test extends Model {
    value1 = 1;
    value2 = 2;
    value3 = 3;
  }

  it("will reveal last update", async () => {
    const test = Test.create();

    test.value1 = 2;
    test.value2 = 3;

    const update = await test.update();
    const updated = test[WHY];

    expect(update).toStrictEqual(updated);

    expect(updated).toContain("value1");
    expect(updated).toContain("value2");
  })

  it("will reveal cause for update", async () => {
    const test = Test.create();

    let update: readonly string[] | undefined;
    let fullUpdate: readonly string[] | false;

    test.effect(state => {
      void state.value1;
      void state.value3;

      update = state[WHY];
    })

    expect(update).toBeUndefined();

    test.value1 = 2;
    test.value2 = 3;

    fullUpdate = await test.update();

    // sanity check
    expect(update).not.toStrictEqual(fullUpdate);
    expect(fullUpdate).toContain("value2");

    expect(update).toContain("value1");
    expect(update).not.toContain("value2");

    test.value3 = 4;

    fullUpdate = await test.update();

    // sanity check
    expect(fullUpdate).not.toContain("value1");

    expect(update).toContain("value3");
    expect(fullUpdate).toContain("value3");
  })
})

describe("toString", () => {
  class Test extends Model {};

  it("Model will cast to string as class name", () => {
    const test = Test.create();
    expect(String(test)).toBe("Test");
  })
})

describe("errors", () => {
  const warn = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});

  afterEach(() => warn.mockReset());
  afterAll(() => warn.mockRestore())

  it("will log update errors in the console", async () => {
    class Test extends Model {
      value = 1;
    };

    const expected = new Error("Goodbye cruel world!")
    const test = Test.create();

    test.on("value", () => {
      throw expected;
    });

    test.value = 2;

    await test.update();

    expect(warn).toBeCalledWith(expected);
  });
})