import { Model } from '../model';

export async function assertDidUpdate(
  model: Model, exists?: boolean){

  const assert = expect(model.on(0)).resolves;

  return exists === false
    ? assert.toBe(false)
    : assert.toBeTruthy();
}

export function mockAsync<T = void>(){
  const pending = new Set<[Function, Function]>();

  const event = () => (
    new Promise<T>((res, rej) => {
      pending.add([res, rej]);
    })
  );

  const resolve = (value: T) => {
    const done = event();

    pending.forEach(x => x[0](value));
    pending.clear();

    return done;
  }

  return {
    pending: event,
    resolve
  }
}

export function mockConsole(){
  const warn = jest
    .spyOn(global.console, "warn")
    .mockImplementation(() => {});

  const error = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});

  afterEach(() => {
    warn.mockReset();
    error.mockReset();
  });

  afterAll(() => {
    warn.mockReset();
    error.mockRestore();
  });

  return {
    error,
    warn
  }
}