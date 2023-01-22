import { mockAsync } from './helper/testing';
import { use } from './instruction/use';
import { Model } from './model';

it('will subscribe to child controllers', async () => {
  class Parent extends Model {
    value = "foo";
    empty = undefined;
    child = use(Child);
  }

  class Child extends Model {
    value = "foo"
    grandchild = use(GrandChild);
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