import Controller from './lib';
import { trySubscribe } from './adapter';

class Parent extends Controller {
  foo = "bar";
  child = new Child();
}

class Child extends Controller {
  bar = "foo";
}

test('tracks nested controllers', async () => {
  const { state, assertDidUpdate } = trySubscribe(() => {
    const instance = Parent.use();
    void instance.foo;
    void instance.child.bar;
    return instance;
  });

  expect(state.foo).toBe("bar");
  expect(state.child.bar).toBe("foo");

  state.foo = "foo";
  await assertDidUpdate();

  state.child.bar = "bar";
  await assertDidUpdate();
})