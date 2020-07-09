import Controller from './lib';
import { trySubscribe } from './adapter';

class Child extends Controller {
  bar = "foo";
}

class Parent extends Controller {
  static hello = "world";
  static foo = new Child();
  
  foo = "bar";
  child = new Child();
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

test('tracks static values on meta', async () => {
  const { state, assertDidUpdate } = trySubscribe(() => {
    const instance = Parent.meta();
    void instance.hello;
    return instance;
  });

  expect(state.hello).toBe("world");

  state.hello = "World!";

  await assertDidUpdate();

  expect(state.hello).toBe("World!");
})

test('tracks controller values on meta', async () => {
  const { state, assertDidUpdate } = trySubscribe(() => {
    const instance = Parent.meta();
    void instance.foo;
    void instance.foo.bar;
    return instance;
  });

  expect(state.foo.bar).toBe("foo");

  // Will refresh on sub-value change.
  state.foo.bar = "bar";
  await assertDidUpdate();
  expect(state.foo.bar).toBe("bar");

  // Will refresh on repalcement.
  state.foo = new Child();
  await assertDidUpdate();
  expect(state.foo.bar).toBe("foo");

  // Fresh subscription does work.
  state.foo.bar = "bar";
  await assertDidUpdate();
  expect(state.foo.bar).toBe("bar");
})