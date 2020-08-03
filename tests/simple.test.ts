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
    trySubscribe({
      use: Subject
    })

  expect(state.value).toBe(1);
  expect(state.value2).toBe(2);
})

test('updates on value change', async () => {
  const { state, assertDidUpdate } = 
    trySubscribe({
      use: Subject,
      peek: "value" 
    })
  
  state.value = 2

  await assertDidUpdate();
  
  expect(state.value).toBe(2);
})

test('methods may change state', async () => {
  const { state, assertDidUpdate } = 
    trySubscribe({
      use: Subject,
      peek: "value" 
    })
  
  state.setValueToThree();

  await assertDidUpdate();

  expect(state.value).toBe(3)
})

test('no update on untracked value change', async () => {
  const { state, assertDidNotUpdate } = 
    trySubscribe({
      use: Subject
    })
  
  state.value = 2

  await assertDidNotUpdate();
  
  expect(state.value).toBe(2);
})

test('set & get are circular references', async () => {
  const { state, assertDidUpdate } = 
    trySubscribe({
      use: Subject,
      peek: "value" 
    })
  
  expect(state.get.value).toBe(1);

  state.set.value = 2;

  await assertDidUpdate()

  expect(state.get.value).toBe(2)
})