import { Controller, Singleton, test } from "./adapter";

class Child extends Controller {
  value = "foo"
}

class Parent extends Singleton {
  value = "foo";
  child = new Child();
}

const ambient = Parent.create();

it('access subvalue directly with tap', async () => {
  const { state, assertDidUpdate } = 
    test(() => {
      return Parent.tap("value")
    })

  expect(state).toBe("foo");

  ambient.value = "bar";

  await assertDidUpdate();
})

it('access sub-controller with tap', async () => {
  const { state, assertDidUpdate } = 
    test(() => {
      return Parent.tap("child")
    })

  expect(state.value).toBe("foo");

  state.value = "bar"

  await assertDidUpdate();

  expect(state.value).toBe("bar");

  ambient.child = new Child();

  await assertDidUpdate();
})