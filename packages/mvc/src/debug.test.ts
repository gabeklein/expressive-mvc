import { Debug } from './debug';
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