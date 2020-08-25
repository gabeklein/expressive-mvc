import Controller from './lib';
import { trySubscribe } from './adapter';

class Child extends Controller {
  value = "foo"
}

class Parent extends Controller {
  foo = "bar";
  bar = new Child();
}

test('tracks values of nested controllers', async () => {
  const { state, assertDidUpdate } = 
    trySubscribe(() => {
      const instance = Parent.use();

      //simulate destructure access
      void instance.foo;
      void instance.bar.value;

      return instance;
    });

  expect(state.foo).toBe("bar");
  expect(state.bar.value).toBe("foo");

  state.foo = "foo";
  await assertDidUpdate();

  state.bar.value = "bar";
  await assertDidUpdate();
})