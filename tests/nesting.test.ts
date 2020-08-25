import Controller, { trySubscribe } from "./adapter";

class Child extends Controller {
  value = "foo"
}

class Parent extends Controller {
  value = "foo";
  child = new Child();
}

it('tracks values of nested controllers', async () => {
  const { state, assertDidUpdate } = 
    trySubscribe(Parent, ["value", "child.value"])

  expect(state.value).toBe("foo");
  expect(state.child.value).toBe("foo");

  state.value = "bar";
  await assertDidUpdate();

  state.child.value = "bar";
  await assertDidUpdate();
})