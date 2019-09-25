import Controller from "../";
import { trySubscriber } from "./adapter";

class TestController extends Controller {

  init?: string;

  constructor(init?: string){
    super();
    this.init = init;
  }

  value = 1;
  value2 = 2;

  setValueToThree = () => this.value = 3;
}

test('initializes from extended Controller', () => {
  const { result } = trySubscriber(
    () => TestController.use()
  )

  expect(result.current.value).toBe(1);
  expect(result.current.value2).toBe(2);
})

test('passes arguments to constructor', () => {
  const { result } = trySubscriber(
    () => TestController.use("Hello World!")
  )

  expect(result.current.init).toBe("Hello World!");
})

test('ignores updates on useOnce', async () => {
  const { result, assertDidNotUpdate } = trySubscriber(
    () => TestController.useOnce()
  )

  expect(result.current.value).toBe(1);

  result.current.value = 2;

  await assertDidNotUpdate();
})