import Controller from './lib';
import { trySubscribe } from './adapter';

class Subject extends Controller {
  value = 1;
  value2 = 2;

  setValueToThree = () => {
    this.value = 3;
  }
}

test('loads values from class', () => {
  const { state } = 
    trySubscribe(() => Subject.use());

  expect(state.value).toBe(1);
  expect(state.value2).toBe(2);
})

test('updates on value change', async () => {
  const { state, assertDidUpdate } = 
    trySubscribe(() => {
      const instance = Subject.use();

      // simulate access, indicating `value` 
      // should be inferred as a watched value
      void instance.value;

      return instance;
    });
  
  state.value = 2

  await assertDidUpdate();
  
  expect(state.value).toBe(2);
})

test('methods may change state', async () => {
  const { state, assertDidUpdate } = 
    trySubscribe(() => {
      const control = Subject.use();
      void control.value;
      return control;
    });
  
  state.setValueToThree();

  await assertDidUpdate();

  expect(state.value).toBe(3)
})

test('no update on untracked value change', async () => {
  const { state, assertDidNotUpdate } = 
    trySubscribe(() => Subject.use())
  
  state.value = 2

  await assertDidNotUpdate();
  
  expect(state.value).toBe(2);
})

test('set & get are circular references', async () => {
  const { state, assertDidUpdate } = 
    trySubscribe(() => {
      const instance = Subject.use();
      void instance.value;

      return instance;
    });
  
  expect(state.get.value).toBe(1);

  state.set.value = 2;

  await assertDidUpdate()

  expect(state.get.value).toBe(2)
})