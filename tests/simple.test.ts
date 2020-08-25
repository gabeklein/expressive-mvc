import Controller, { test } from "./adapter";

class Subject extends Controller {
  value = 1;
  value2 = 2;

  setValueToThree = () => {
    this.value = 3;
  }
}

it('loads values from class', () => {
  const { state } = test(Subject);

  expect(state.value).toBe(1);
  expect(state.value2).toBe(2);
})

it('updates on value change', async () => {
  const { state, assertDidUpdate } =
    test(Subject, ["value"]);
  
  state.value = 2
  await assertDidUpdate();
  expect(state.value).toBe(2);
})

it('methods may change state', async () => {
  const { state, assertDidUpdate } =
    test(Subject, ["value"]);
  
  state.setValueToThree();
  await assertDidUpdate();
  expect(state.value).toBe(3)
})

it('no update on untracked value change', async () => {
  const { state, assertDidNotUpdate } = test(Subject);
  
  state.value = 2

  await assertDidNotUpdate();
  expect(state.value).toBe(2);
})

it('set & get are circular references', async () => {
  const { state, assertDidUpdate } =
    test(Subject, ["value"]);
  
  expect(state.get.value).toBe(1);

  state.set.value = 2;
  await assertDidUpdate()
  expect(state.get.value).toBe(2)
})