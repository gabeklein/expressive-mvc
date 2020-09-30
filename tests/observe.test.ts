import Controller, { test } from "./adapter";

class Subject extends Controller {
  seconds = 0;

  get minutes(){
    return Math.floor(this.seconds / 60)
  }
}

it('dispatches changes to observer', async () => {
  const { state, assertDidNotUpdate } = test(Subject);
  const callback = jest.fn();

  state.watch("seconds", callback);
  state.seconds = 30;

  await assertDidNotUpdate();

  expect(callback).toBeCalledWith(30, "seconds");
})

it('dispatches changes to computed value', async () => {
  const { state, assertDidNotUpdate } = test(Subject);
  const callback = jest.fn();

  state.watch("minutes", callback);
  state.seconds = 60;
  await assertDidNotUpdate();

  expect(callback).toBeCalledWith(1, "minutes");
})

it('dispatches multiple values to observer', async () => {
  const { state, assertDidNotUpdate } = test(Subject);
  const callback = jest.fn();

  state.watch([
    "seconds",
    "minutes"
  ], callback);
  
  state.seconds = 60;
  await assertDidNotUpdate();

  expect(callback).toBeCalledWith(1, "minutes");
  expect(callback).toBeCalledWith(60, "seconds");
})