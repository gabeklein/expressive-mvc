import Controller, { trySubscribe } from "./adapter";

class Subject extends Controller {
  seconds = 0;
  foo = "bar";

  get minutes(){
    return Math.floor(this.seconds / 60)
  }
}

it('will export with callback run every update', async () => {
  const { state, assertDidNotUpdate } = trySubscribe(Subject);
  const mock = jest.fn()

  state.export(mock)

  // should not call without change having occured
  expect(mock).not.toHaveBeenCalled()

  state.seconds = 90;

  await assertDidNotUpdate()

  expect(mock).toBeCalledWith(
    // does contain all tracked values
    { minutes: 1, seconds: 90, foo: "bar" }, 
    // does list updated values
    expect.arrayContaining(["seconds", "minutes"])
  );
})

it('fires callbacks with `initial = true` immediately', async () => {
  const { state, assertDidNotUpdate } = trySubscribe(Subject);
  const mock = jest.fn()

  state.export(mock, true);

  expect(mock).toHaveBeenCalled();

  state.seconds = 90;

  await assertDidNotUpdate()

  expect(mock).toHaveBeenCalledTimes(2);
})

it('exports only subset values where requested', async () => {
  const { state, assertDidNotUpdate } = trySubscribe(Subject);
  const mock = jest.fn()

  state.export(["seconds", "minutes"], mock)

  expect(mock).not.toHaveBeenCalled()
  
  state.seconds = 30;

  await assertDidNotUpdate()

  expect(mock).toBeCalledWith(
    // only contains values for keys requested
    { minutes: 0, seconds: 30 },
    // only contains "seconds" which had updated
    [ "seconds" ]                 
  );

  state.foo = "baz"

  await assertDidNotUpdate()

  // should not be called again as "baz" isn't tracked
  expect(mock).toHaveBeenCalledTimes(1);
})