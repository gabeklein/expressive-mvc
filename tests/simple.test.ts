import { renderHook, act } from "@testing-library/react-hooks";
import { use } from "../";

class TestController {
  value = 1;
  value2 = 2;

  setValueToThree = () => this.value = 3
}

const useTestController = () => {
  const { result } =  renderHook(() => use(TestController));
  return result;
}

it('loads values from class', () => {
  const hook = useTestController();
  expect(hook.current.value).toBe(1);
  expect(hook.current.value2).toBe(2);
})

it('updates on value change', () => {
  const hook = useTestController();
  
  act(() => {
    hook.current.value = 2
  })

  expect(hook.current.value).toBe(2)
})

it('allows methods to change state', () => {
  const hook = useTestController();
  
  act(() => {
    hook.current.setValueToThree();
  })

  expect(hook.current.value).toBe(3)
})

test('set/get reference full state', () => {
  const hook = useTestController();

  expect(hook.current.get.value).toBe(1);

  act(() => {
    hook.current.set.value = 2;
  })

  expect(hook.current.value).toBe(2)
})