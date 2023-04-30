import { Control, Oops } from './control';
import { mockAsync } from './helper/testing';
import { Model } from './model';

describe("child models", () => {
  it('will subscribe', async () => {
    class Parent extends Model {
      value = "foo";
      empty = undefined;
      child = new Child();
    }
  
    class Child extends Model {
      value = "foo"
      grandchild = new GrandChild();
    }
  
    class GrandChild extends Model {
      value = "bar"
    }
  
    const parent = Parent.new();
    const effect = jest.fn();
    let promise = mockAsync();
  
    parent.on(state => {
      const { child } = state;
      const { grandchild } = child;
  
      effect(child.value, grandchild.value);
      promise.resolve();
    })
  
    expect(effect).toBeCalledWith("foo", "bar");
    effect.mockClear();
  
    promise = mockAsync();
    parent.child.value = "bar";
    await promise;
    
    expect(effect).toBeCalledWith("bar", "bar");
    effect.mockClear();
  
    promise = mockAsync();
    parent.child = new Child();
    await promise;
    
    expect(effect).toBeCalledWith("foo", "bar");
    effect.mockClear();
  
    promise = mockAsync();
    parent.child.value = "bar";
    await promise;
    
    expect(effect).toBeCalledWith("bar", "bar");
    effect.mockClear();
  
    promise = mockAsync();
    parent.child.grandchild.value = "foo";
    await promise;
    
    expect(effect).toBeCalledWith("bar", "foo");
    effect.mockClear();
  });
  
  it('will only assign matching model', () => {
    class Child extends Model {}
    class Unrelated extends Model {};
    class Parent extends Model {
      child = new Child();
    }
  
    const parent = Parent.new("ID");
  
    expect(() => {
      parent.child = Unrelated.new("ID");
    }).toThrowError(
      Oops.BadAssignment(`Parent-ID.child`, `Child`, "Unrelated-ID")
    );
  
    expect(() => {
      // @ts-ignore
      parent.child = undefined;
    }).toThrowError(
      Oops.BadAssignment(`Parent-ID.child`, `Child`, `undefined`)
    );
  })
});

it("will call dispatch callbacks", async () => {
  const didUpdate = jest.fn();
  const willUpdate = jest.fn();
  
  Control.beforeUpdate.add(willUpdate);
  Control.afterUpdate.add(didUpdate);

  class Test extends Model {
    value = 1;
  }

  const test = Test.new();

  test.value += 1;
  await expect(test).toUpdate();

  expect(willUpdate).toBeCalledTimes(1);
  expect(didUpdate).toBeCalledTimes(1);

  Control.beforeUpdate.delete(willUpdate);
  Control.afterUpdate.delete(didUpdate);
})