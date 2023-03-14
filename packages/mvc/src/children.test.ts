import { Oops } from './children';
import { mockAsync } from './helper/testing';
import { Model } from './model';

it('will subscribe to child controllers', async () => {
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
  const promise = mockAsync();

  parent.on(state => {
    const { child } = state;
    const { grandchild } = child;

    effect(child.value, grandchild.value);
    promise.resolve();
  })

  expect(effect).toBeCalledWith("foo", "bar");
  effect.mockClear();

  parent.child.value = "bar";
  
  await promise.pending();
  expect(effect).toBeCalledWith("bar", "bar");
  effect.mockClear();

  parent.child = new Child();
  
  await promise.pending();
  expect(effect).toBeCalledWith("foo", "bar");
  effect.mockClear();

  parent.child.value = "bar";
  
  await promise.pending();
  expect(effect).toBeCalledWith("bar", "bar");
  effect.mockClear();

  parent.child.grandchild.value = "foo";
  
  await promise.pending();
  expect(effect).toBeCalledWith("bar", "foo");
  effect.mockClear();
})

it('will only assign matching model', () => {
  class Parent extends Model {
    child = new Child();
  }

  class Child extends Model {}
  class Unrelated extends Model {};

  const parent = Parent.new();

  expect(() => {
    parent.child = new Unrelated();
  }).toThrowError(
    Oops.BadAssignment(`Parent.child`, `Child`, `Unrelated`)
  );

  expect(() => {
    // @ts-ignore
    parent.child = undefined;
  }).toThrowError(
    Oops.BadAssignment(`Parent.child`, `Child`, `undefined`)
  );
})