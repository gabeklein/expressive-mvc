import Controller, { trySubscribe } from "./adapter";

class Subject extends Controller {
  value = 1;
  value2 = 2;

  setValueToThree = () => {
    this.value = 3;
  }
}

test('loads values from class', () => {
  const { state } = trySubscribe(Subject);

  expect(state.value).toBe(1);
  expect(state.value2).toBe(2);
})

test('updates on value change', async () => {
  const { state, assertDidUpdate } =
    trySubscribe(Subject, ["value"]);
  
  state.value = 2

  await assertDidUpdate();
  
  expect(state.value).toBe(2);
})

test('methods may change state', async () => {
  const { state, assertDidUpdate } =
    trySubscribe(Subject, ["value"]);
  
  state.setValueToThree();

  await assertDidUpdate();

  expect(state.value).toBe(3)
})

test('no update on untracked value change', async () => {
  const { state, assertDidNotUpdate } = 
    trySubscribe(Subject);
  
  state.value = 2

  await assertDidNotUpdate();
  
  expect(state.value).toBe(2);
})

test('set & get are circular references', async () => {
  const { state, assertDidUpdate } =
    trySubscribe(Subject, ["value"]);
  
  expect(state.get.value).toBe(1);

  state.set.value = 2;

  await assertDidUpdate()

  expect(state.get.value).toBe(2)
})