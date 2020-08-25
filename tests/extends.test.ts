import Controller, { trySubscribe } from "./adapter";

class Subject extends Controller {
  value = 1;
  value2 = 2;

  constructor(
    public init?: string){
    super();
  }

  setValueToThree = () => {
    this.value = 3;
  }
}

it('initializes from extended Controller', () => {
  const { state } = trySubscribe(Subject);

  expect(state.value).toBe(1);
  expect(state.value2).toBe(2);
})

it('passes arguments to constructor', () => {
  const { state } = trySubscribe(
    () => Subject.use("Hello World!")
  )

  expect(state.init).toBe("Hello World!");
})

it('can initialize a Provider', () => {
  trySubscribe(() => {
    const control = Subject.use();
    void control.Provider;
    return control;
  })
})