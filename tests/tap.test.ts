import { Controller, Singleton, test } from "./adapter";

class Parent extends Singleton {
  value = "foo";
  child = new Child();
}

class Child extends Controller {
  value = "foo"
  grandchild = new GrandChild();
}

class GrandChild extends Controller {
  value = "bar"
}

const singleton = Parent.create();

it('access subvalue directly with tap', async () => {
  const { state, assertDidUpdate } = 
    test(() => Parent.tap("value") as any)

  expect(state).toBe("foo");

  singleton.value = "bar";

  await assertDidUpdate();
})

it('access child controller with tap', async () => {
  const { state, assertDidUpdate } = 
    test(() => Parent.tap("child"))

  expect(state.value).toBe("foo");

  state.value = "bar"

  await assertDidUpdate();

  expect(state.value).toBe("bar");

  singleton.child = new Child();

  await assertDidUpdate();
})

it('access nested controllers with tap', async () => {
  const { state } = 
    test(() => Parent.tap("child", "grandchild"))

  expect(state.value).toBe("bar");
})