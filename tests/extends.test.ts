import Controller from "./lib";
import { trySubscribe } from "./adapter";

class Subject extends Controller {

  init?: string;

  constructor(init?: string){
    super();
    this.init = init;
  }

  value = 1;
  value2 = 2;

  setValueToThree = () => {
    this.value = 3;
  }
}

test('initializes from extended Controller', () => {
  const { state } = trySubscribe(
    () => Subject.use()
  )

  expect(state.value).toBe(1);
  expect(state.value2).toBe(2);
})

test('passes arguments to constructor', () => {
  const { state } = trySubscribe(
    () => Subject.use("Hello World!")
  )

  expect(state.init).toBe("Hello World!");
})

test('can initialize a Provider', () => {
  trySubscribe({
    use: Subject,
    peek: "Provider"
  })
})