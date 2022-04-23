import { from, Model } from '../src';
import { CONTROL, LOCAL, STATE, WHY } from '../src/model';

describe("update method", () => {
  class Control extends Model {
    foo = 1;
    bar = 2;
    baz = from(this, state => {
      return state.bar + 1;
    });
  }

  it("provides promise resolving next update", async () => {
    const control = Control.create();
    
    control.foo = 2;
    await control.update();
    
    control.bar = 3;
    await control.update();
  })

  it("resolves keys next update involved", async () => {
    const control = Control.create();

    control.foo = 2;

    const updated = await control.update();
    expect(updated).toMatchObject(["foo"]);
  })

  it('resolves immediately when no updates pending', async () => {
    const control = Control.create();
    const update = await control.update();

    expect(update).toBe(false);
  })

  it('rejects if no update pending in strict mode', async () => {
    const control = Control.create();
    const update = control.update(true);

    await expect(update).rejects.toThrowError();
  })

  it('rejects if update not expected in strict mode', async () => {
    const control = Control.create();

    control.foo = 2;

    const update = control.update(false);

    await expect(update).rejects.toThrowError();
  })

  it("includes getters in batch which trigger them", async () => {
    const control = Control.create();

    // we must evaluate baz because it can't be
    // subscribed to without this happening atleast once. 
    expect(control.baz).toBe(3);

    control.bar = 3;

    const update = await control.update();

    expect(update).toMatchObject(["bar", "baz"]);
  })
})

describe("update property", () => {
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

describe("isTypeof method", () => {
  class Test extends Model {}
  class Test2 extends Test {}
  
  it("will assert if Model extends another", () => {
    expect(Test.isTypeof(Test2)).toBeTruthy();
  })
})

describe("Model", () => {
  class FooBar extends Model {
    foo = "foo";
    bar = "bar";
  }

  it("will expose symbols", () => {
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