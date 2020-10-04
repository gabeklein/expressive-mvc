import Controller, { test, ref } from "./adapter";

class Subject extends Controller {
  checkValue?: any = undefined;

  // set explicitly as a string for this test.
  ref1 = ref<string>();

  ref2 = ref<symbol>(value => {
    this.checkValue = value;
  })

  ref3 = ref<number>(() => {
    return () => {
      this.checkValue = true;
    }
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

  expect(state.checkValue).toBe(undefined);
  state.once("ref2", callback);
  state.ref2.current = targetValue;
  expect(state.checkValue).toBe(targetValue);
  await assertDidUpdate();
  expect(callback).toBeCalledWith(targetValue, "ref2");
})

it('invokes callback on ref overwrite', async () => {
  const { state, assertDidUpdate } = test(Subject, ["ref3"]);

  state.ref3.current = 1;
  await assertDidUpdate();
  expect(state.checkValue).toBe(undefined);
  state.ref3.current = 2;
  await assertDidUpdate();
  expect(state.checkValue).toBe(true);
})
