import Controller from "./lib";
import { trySubscribe } from "./adapter";

class TestController extends Controller {
  seconds = 0;
  foo = "bar";

  get minutes(){
    return Math.floor(this.seconds / 60)
  }
}

test('export with callback run every update', async () => {
  const fn = jest.fn()
  const { state, assertDidNotUpdate } = 
    trySubscribe({ use: TestController });

  state.export(fn)

  // should only call when a change occures
  expect(fn).not.toHaveBeenCalled()

  state.seconds = 90;

  await assertDidNotUpdate()

  expect(fn).toBeCalledWith(
    // contains all tracked values
    { minutes: 1, seconds: 90, foo: "bar" }, 
    // lists updated values
    expect.arrayContaining(["seconds", "minutes"])
  );
})

test('callback with [initial: true] fires immediately', async () => {
  const fn = jest.fn()
  const { state, assertDidNotUpdate } = 
    trySubscribe({ use: TestController });

  state.export(fn, true);

  expect(fn).toHaveBeenCalled();

  state.seconds = 90;

  await assertDidNotUpdate()

  expect(fn).toHaveBeenCalledTimes(2);
})

test('subset export calls only with / or those values', async () => {
  const fn = jest.fn()
  const { state, assertDidNotUpdate } = 
    trySubscribe({ use: TestController });

  state.export(["seconds", "minutes"], fn)

  expect(fn).not.toHaveBeenCalled()
  
  state.seconds = 30;

  await assertDidNotUpdate()

  expect(fn).toBeCalledWith(
    // only has requested keys
    { minutes: 0, seconds: 30 },
    // only "seconds" had updated
    [ "seconds" ]                 
  );

  state.foo = "baz"

  await assertDidNotUpdate()

  // not called again
  expect(fn).toHaveBeenCalledTimes(1);
})