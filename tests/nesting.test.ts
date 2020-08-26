import Controller, { test } from "./adapter";

class Child extends Controller {
  value = "foo"
}

class Parent extends Controller {
  value = "foo";
  child = new Child();
}

it('tracks values of nested controllers', async () => {
  const { state, assertDidUpdate } = 
    test(Parent, ["value", "child.value"])

  expect(state.value).toBe("foo");
  expect(state.child.value).toBe("foo");

  state.value = "bar";
  await assertDidUpdate();

  state.child.value = "bar";
  await assertDidUpdate();
})

it('tracks a new child as update to nested value', async () => {
  const { state, assertDidUpdate } = 
    test(Parent, ["child", "child.value"]);

  expect(state.child.value).toBe("foo");

  // Will refresh on sub-value change.
  state.child.value = "bar";
  await assertDidUpdate();
  expect(state.child.value).toBe("bar");

  // Will refresh on repalcement.
  state.child = new Child();
  await assertDidUpdate();
  expect(state.child.value).toBe("foo");

  // Fresh subscription does still work.
  state.child.value = "bar";
  await assertDidUpdate();
  expect(state.child.value).toBe("bar");
})