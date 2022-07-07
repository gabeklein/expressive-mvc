import { get, Model } from '../src';
import { Oops } from '../src/model';

class Subject extends Model {
  seconds = 0;
  hours = 0;

  minutes = get(this, state => {
    return Math.floor(state.seconds / 60)
  })
}

it('will ignore subsequent events', async () => {
  const state = Subject.create();
  const callback = jest.fn();

  state.once("seconds", callback);

  state.seconds = 30;
  await state.update();

  expect(callback).toBeCalledWith(30, "seconds");

  state.seconds = 45;
  await state.update();

  expect(callback).not.toBeCalledWith(45, "seconds");
})

it('will return promise with update keys', async () => {
  const state = Subject.create();
  const pending = state.once("seconds");

  state.seconds = 30;

  await expect(pending).resolves.toBeUndefined();
})

it('will reject promise on timeout', async () => {
  const state = Subject.create();
  const promise = state.once("seconds", 0);
  const expected = Oops.Timeout(["seconds"], "0ms");

  await expect(promise).rejects.toThrow(expected);
})

it('will reject promise on destroy state', async () => {
  const state = Subject.create();
  const promise = state.once("seconds");
  const expected = Oops.Timeout(["seconds"], `lifetime of ${state}`);

  state.destroy();

  await expect(promise).rejects.toThrow(expected);
})

it('will call for all simultaneous', async () => {
  const state = Subject.create();
  const callback = jest.fn();

  state.once(["seconds", "minutes"], callback);

  state.seconds = 60;
  await state.update();

  expect(callback).toBeCalledWith(60, "seconds");
  expect(callback).toBeCalledWith(1, "minutes");

  state.seconds = 61;
  await state.update();

  expect(callback).not.toBeCalledWith(61, "seconds");
})