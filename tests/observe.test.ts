import Controller, { test } from "./adapter";

class Subject extends Controller {
  seconds = 0;
  foo = 3;

  get minutes(){
    return Math.floor(this.seconds / 60)
  }
}

it('dispatches changes to observer', async () => {
  const { state, assertDidNotUpdate } = test(Subject);
  const mock = jest.fn()

  state.watch("seconds", mock)
  state.seconds = 30;

  await assertDidNotUpdate();

  expect(mock).toBeCalledWith(30, "seconds");
})

it('dispatches changes to computed value', async () => {
  const { state, assertDidNotUpdate } = test(Subject);
  const mock = jest.fn()

  state.watch("minutes", mock)
  state.seconds = 60;

  await assertDidNotUpdate()

  expect(mock).toBeCalledWith(1, "minutes");
})

it('dispatches multiple values to observer', async () => {
  const { state, assertDidNotUpdate } = test(Subject);
  const mock = jest.fn()

  state.watch(["seconds", "minutes"], mock)
  state.seconds = 60;

  await assertDidNotUpdate()

  expect(mock).toBeCalledWith(1, "minutes");
  expect(mock).toBeCalledWith(60, "seconds");
})

it('runs export callback on every update', async () => {
  const { state, assertDidNotUpdate } = test(Subject);
  const mock = jest.fn()

  state.export(["seconds", "minutes"], mock)
  state.seconds = 90;

  expect(mock).not.toHaveBeenCalled()

  await assertDidNotUpdate()

  expect(mock).toBeCalledWith(
    { minutes: 1, seconds: 90 }, 
    expect.arrayContaining(["seconds", "minutes"])
  );

  state.seconds = 91;

  await assertDidNotUpdate()

  expect(mock).toBeCalledWith(
    { minutes: 1, seconds: 91 }, 
    expect.arrayContaining(["seconds"])
  );
})