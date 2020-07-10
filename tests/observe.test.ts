import Controller from "./lib";
import { trySubscribe } from "./adapter";

class TestController extends Controller {
  seconds = 0;
  foo = 3;

  get minutes(){
    return Math.floor(this.seconds / 60)
  }
}

test('dispatches changes to observer', async () => {
  const fn = jest.fn()
  const { state, assertDidNotUpdate } = 
    trySubscribe({ use: TestController })

  state.watch("seconds", fn)
  state.seconds = 30;

  await assertDidNotUpdate();

  expect(fn).toBeCalledWith(30, "seconds");
})

test('dispatches changes to computed value', async () => {
  const fn = jest.fn()
  const { state, assertDidNotUpdate } = 
    trySubscribe({ use: TestController })

  state.watch("minutes", fn)
  state.seconds = 60;

  await assertDidNotUpdate()

  expect(fn).toBeCalledWith(1, "minutes");
})

test('dispatches multiple values to observer', async () => {
  const fn = jest.fn()
  const { state, assertDidNotUpdate } = 
    trySubscribe({ use: TestController })

  state.watch(["seconds", "minutes"], fn)
  state.seconds = 60;

  await assertDidNotUpdate()

  expect(fn).toBeCalledWith(1, "minutes");
  expect(fn).toBeCalledWith(60, "seconds");
})

test('export with callback run every update', async () => {
  const fn = jest.fn()
  const { state, assertDidNotUpdate } = 
    trySubscribe({ use: TestController });

  state.export(["seconds", "minutes"], fn)
  state.seconds = 90;

  expect(fn).not.toHaveBeenCalled()

  await assertDidNotUpdate()

  expect(fn).toBeCalledWith(
    { minutes: 1, seconds: 90 }, 
    expect.arrayContaining(["seconds", "minutes"])
  );

  state.seconds = 91;

  await assertDidNotUpdate()

  expect(fn).toBeCalledWith(
    { minutes: 1, seconds: 91 }, 
    expect.arrayContaining(["seconds"])
  );
})