import Controller, { trySubscribe } from "./adapter";

class Subject extends Controller {
  seconds = 0;

  get minutes(){
    return Math.floor(this.seconds / 60)
  }
}

test('triggers computed value when input values change', async () => {
  const { state, assertDidNotUpdate, assertDidUpdate } = 
    trySubscribe(Subject, ["minutes"]);

  state.seconds = 30;

  await assertDidNotUpdate();

  expect(state.seconds).toEqual(30);
  expect(state.minutes).toEqual(0);

  await assertDidNotUpdate();
  
  state.seconds = 60;

  await assertDidUpdate();

  expect(state.seconds).toEqual(60);
  expect(state.minutes).toEqual(1);
})