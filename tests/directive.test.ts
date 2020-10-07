import Controller, { test, set } from "./adapter";

class Subject extends Controller {
  checkResult?: any = undefined;

  test1 = set<number>(value => {
    this.checkResult = value + 1;
  });

  test2 = set<number>(value => {
    return () => {
      this.checkResult = true;
    }
  });
}

it('invokes callback of set property', async () => {
  const { state, assertDidUpdate } = test(Subject, ["test1"]);
  const callback = jest.fn();

  expect(state.checkResult).toBe(undefined);
  state.once("test1", callback);
  state.test1 = 1;
  expect(state.checkResult).toBe(2);
  await assertDidUpdate();
  expect(callback).toBeCalledWith(1, "test1");
})

it('invokes callback on property overwrite', async () => {
  const { state, assertDidUpdate } = test(Subject, ["test2"]);

  state.test2 = 1;
  await assertDidUpdate();
  expect(state.checkResult).toBe(undefined);
  state.test2 = 2;
  await assertDidUpdate();
  expect(state.checkResult).toBe(true);
})
