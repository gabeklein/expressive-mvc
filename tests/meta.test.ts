import Controller, { trySubscribe } from "./adapter";

class Child extends Controller {
  value: string;

  constructor(value: string){
    super();
    this.value = value;
  }
}

class Parent extends Controller {
  static foo = "bar";
  static bar = new Child("meta");
}

test('tracks static values on meta', async () => {
  const { state, assertDidUpdate } = trySubscribe(
    () => Parent.meta(), ["foo"]
  );

  expect(state.foo).toBe("bar");

  state.foo = "foo";

  await assertDidUpdate();
  expect(state.foo).toBe("foo");
})

test('tracks nested values on meta', async () => {
  const { state, assertDidUpdate } = trySubscribe(
    () => Parent.meta(), ["bar", "bar.value"]
  );

  expect(state.bar.value).toBe("meta");

  // Will refresh on sub-value change.
  state.bar.value = "bar";
  await assertDidUpdate();
  expect(state.bar.value).toBe("bar");

  // Will refresh on repalcement.
  state.bar = new Child("foo");
  await assertDidUpdate();
  expect(state.bar.value).toBe("foo");

  // Fresh subscription does still work.
  state.bar.value = "bar";
  await assertDidUpdate();
  expect(state.bar.value).toBe("bar");
})