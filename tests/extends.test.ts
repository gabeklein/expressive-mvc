import Controller from "../";
import { trySubscribe } from "./adapter";

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
  const { state } = trySubscribe(
    () => TestController.use()
  )

  expect(state.value).toBe(1);
  expect(state.value2).toBe(2);
})

test('passes arguments to constructor', () => {
  const { state } = trySubscribe(
    () => TestController.use("Hello World!")
  )

  expect(state.init).toBe("Hello World!");
})

test('ignores updates on useOnce', async () => {
  const { state, assertDidNotUpdate } = trySubscribe(
    () => TestController.useOnce()
  )

  expect(state.value).toBe(1);

  state.value = 2;

  await assertDidNotUpdate();
})