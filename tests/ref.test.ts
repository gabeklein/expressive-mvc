import Controller, { test, ref } from "./adapter";

class Subject extends Controller {
  ref2InvokedWith?: symbol = undefined;

  // set generic explicitly as string for test.
  ref1 = ref<string>();

  ref2 = ref<symbol>((value) => {
    // this callback is syncronous and prior actual update
    // value is a new value, ref2 should still be old
    if(value !== this.ref2.current)
      this.ref2InvokedWith = value;
  })
}

it('watches "current" of ref property', async () => {
  const { state, assertDidUpdate } = test(Subject, ["ref1"]);
  const callback = jest.fn()

  state.once("ref1", callback);
  state.ref1.current = "value1";
  await assertDidUpdate();
  expect(callback).toBeCalledWith("value1", "ref1");
})

it('invokes callback of ref property', async () => {
  const { state, assertDidUpdate } = test(Subject, ["ref2"]);
  const targetValue = Symbol("inserted object");
  const callback = jest.fn();

  expect(state.ref2InvokedWith).toBe(undefined);
  state.once("ref2", callback);
  state.ref2.current = targetValue;
  expect(state.ref2InvokedWith).toBe(targetValue);
  await assertDidUpdate();
  expect(callback).toBeCalledWith(targetValue, "ref2");
})
