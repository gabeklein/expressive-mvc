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

it('runs export callback on every update', async () => {
  const { state, assertDidNotUpdate } = test(Subject);
  const callback = jest.fn();

  state.export([
    "seconds",
    "minutes"
  ], callback);
  
  state.seconds = 90;

  expect(callback).not.toHaveBeenCalled();

  await assertDidNotUpdate();

  expect(callback).toBeCalledWith(
    { minutes: 1, seconds: 90 }, 
    expect.arrayContaining([
      "seconds",
      "minutes"
    ])
  );

  state.seconds = 91;

  await assertDidNotUpdate();

  expect(callback).toBeCalledWith(
    { minutes: 1, seconds: 91 }, 
    expect.arrayContaining([
      "seconds"
    ])
  );
})