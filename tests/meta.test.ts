import Controller, { test } from "./adapter";

class Child extends Controller {
  constructor(
    public value: string){
    super();
  }
}

class Parent extends Controller {
  static value = "foo";
  static child = new Child("foo");
}

it('tracks static values on meta', async () => {
  const { state, assertDidUpdate } = test(
    () => Parent.meta(),
    ["value"]
  );

  expect(state.value).toBe("foo");

  state.value = "bar";

  await assertDidUpdate();
  expect(state.value).toBe("bar");
})

it('tracks child controller values on meta', async () => {
  const { state, assertDidUpdate } = test(
    () => Parent.meta(),
    ["child", "child.value"]
  );

  expect(state.child.value).toBe("foo");

  // Will refresh on sub-value change.
  state.child.value = "bar";
  await assertDidUpdate();
  expect(state.child.value).toBe("bar");

  // Will refresh on repalcement.
  state.child = new Child("foo");
  await assertDidUpdate();
  expect(state.child.value).toBe("foo");

  // Fresh subscription does still work.
  state.child.value = "bar";
  await assertDidUpdate();
  expect(state.child.value).toBe("bar");
})