import Controller, { use } from './lib';
import { trySubscribe } from './adapter';

class TestController extends Controller {
  value = 1;
  value2 = 2;

  setValueToThree = () => {
    this.value = 3;
  }
}

test('loads values from class', () => {
  const { state } = trySubscribe(
    () => use(TestController)
  );

  expect(state.value).toBe(1);
  expect(state.value2).toBe(2);
})

test('updates on value change', async () => {
  const { state, assertDidUpdate } = 
    trySubscribe({
      use: TestController,
      peek: "value" 
    })
  
  state.value = 2

  await assertDidUpdate();
  
  expect(state.value).toBe(2);
})

test('allows methods to change state', async () => {
  const { state, assertDidUpdate } = 
    trySubscribe({
      use: TestController,
      peek: "value" 
    })
  
  state.setValueToThree();

  await assertDidUpdate();

  expect(state.value).toBe(3)
})

test('will not update on untracked value change', async () => {
  const { state, assertDidNotUpdate } = 
    trySubscribe({
      use: TestController,
      // peek: "value"
    })
  
  state.value = 2

  await assertDidNotUpdate();
  
  expect(state.value).toBe(2);
})

test('set/get reference full state', async () => {
  const { state, assertDidUpdate } = 
    trySubscribe({
      use: TestController,
      peek: "value" 
    })
  
  expect(state.get.value).toBe(1);

  state.set.value = 2;

  await assertDidUpdate()

  expect(state.value).toBe(2)
})