import Controller, { trySubscribe } from "./adapter";

class Subject extends Controller {
  seconds = 0;
  foo = "bar";

  get minutes(){
    return Math.floor(this.seconds / 60)
  }
}

test('export with callback run every update', async () => {
  const fn = jest.fn()
  const { state, assertDidNotUpdate } = 
    trySubscribe(() => Subject.use());

  state.export(fn)

  // should not call without change having occured
  expect(fn).not.toHaveBeenCalled()

  state.seconds = 90;

  await assertDidNotUpdate()

  expect(fn).toBeCalledWith(
    // does contain all tracked values
    { minutes: 1, seconds: 90, foo: "bar" }, 
    // does list updated values
    expect.arrayContaining(["seconds", "minutes"])
  );
})

test('callback with initial = true fires immediately', async () => {
  const fn = jest.fn()
  const { state, assertDidNotUpdate } = 
    trySubscribe(() => Subject.use());

  state.export(fn, true);

  expect(fn).toHaveBeenCalled();

  state.seconds = 90;

  await assertDidNotUpdate()

  expect(fn).toHaveBeenCalledTimes(2);
})

test('subset export calls only with / or those values', async () => {
  const fn = jest.fn()
  const { state, assertDidNotUpdate } = 
    trySubscribe(() => Subject.use());

  state.export(["seconds", "minutes"], fn)

  expect(fn).not.toHaveBeenCalled()
  
  state.seconds = 30;

  await assertDidNotUpdate()

  expect(fn).toBeCalledWith(
    // only contains values for keys requested
    { minutes: 0, seconds: 30 },
    // only contains "seconds" which had updated
    [ "seconds" ]                 
  );

  state.foo = "baz"

  await assertDidNotUpdate()

  // should not be called again as "baz" isn't tracked
  expect(fn).toHaveBeenCalledTimes(1);
})