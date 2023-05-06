export function mockPromise<T = void>(){
  let resolve!: (value?: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res as any;
    reject = rej;
  });

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