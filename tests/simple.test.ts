import { renderHook } from '@testing-library/react-hooks';

import Controller, { use } from '../';
import { trySubscriber } from './adapter';

class TestController extends Controller {
  value = 1;
  value2 = 2;

  setValueToThree = () => this.value = 3
}

test('loads values from class', () => {
  const { result } = renderHook(() => use(TestController));
  expect(result.current.value).toBe(1);
  expect(result.current.value2).toBe(2);
})

test('updates on value change', async () => {
  const { result, assertDidUpdate } = 
    trySubscriber({
      use: TestController,
      peek: "value" 
    })
  
  result.current.value = 2

  await assertDidUpdate();
  
  expect(result.current.value).toBe(2);
})

test('will not update on untracked value change', async () => {
  const { result, assertDidNotUpdate } = 
    trySubscriber({
      use: TestController,
      // peek: "value"
    })
  
  result.current.value = 2

  await assertDidNotUpdate();
  
  expect(result.current.value).toBe(2);
})

test('allows methods to change state', async () => {
  const { result, assertDidUpdate } = 
    trySubscriber({
      use: TestController,
      peek: "value" 
    })
  
  result.current.setValueToThree();

  await assertDidUpdate();

  expect(result.current.value).toBe(3)
})

test('set/get reference full state', async () => {
  const { result, assertDidUpdate } = 
    trySubscriber({
      use: TestController,
      peek: "value" 
    })
  
  expect(result.current.get.value).toBe(1);

  result.current.set.value = 2;

  await assertDidUpdate()

  expect(result.current.value).toBe(2)
})