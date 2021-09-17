// import { Oops } from '../src/stateful';
import { from, Model } from './adapter';

describe("update method", () => {
  class Control extends Model {
    foo = 1;
    bar = 2;
    baz = from((state: this) => {
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
    expect(Model.CONTROL).toBeDefined()
    expect(Model.STATE).toBeDefined()
    expect(Model.LOCAL).toBeDefined()
  })

  it("will expose instance controller", () => {
    const instance = FooBar.create();
    const controller = instance[Model.CONTROL];

    expect(controller).toBeDefined();
  })

  it("will expose instance state", () => {
    const instance = FooBar.create();
    const exported = instance.export();
    const state = instance[Model.STATE];

    expect(state).toMatchObject(exported);
  })

  it("will expose subscriber within listener", () => {
    const instance = FooBar.create();

    expect(instance[Model.LOCAL]).toBeUndefined();

    instance.effect(local => {
      expect(local[Model.CONTROL]).toBe(instance[Model.CONTROL]);
      expect(local[Model.LOCAL]).toBeDefined();
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