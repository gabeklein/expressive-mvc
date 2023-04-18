import { Model } from '../model';

export async function assertDidUpdate(
  model: Model, exists?: boolean){

  const assert = expect(model.on(0)).resolves;

  return exists === false
    ? assert.toBe(false)
    : assert.toBeTruthy();
}

export function mockAsync<T = void>(timeout = 250){
  let resolve!: (value?: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res as any;
    reject = rej;
  });

  setTimeout(() => {
    reject(new Error("timeout"));
  }, timeout);

  return Object.assign(promise, { resolve, reject });
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