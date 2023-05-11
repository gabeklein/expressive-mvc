interface MockPromise<T> extends Promise<T> {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

export function mockPromise<T = void>(){
  const methods = {} as MockPromise<T>;
  const promise = new Promise((res, rej) => {
    methods.resolve = res;
    methods.reject = rej;
  }) as MockPromise<T>;

  return Object.assign(promise, methods);
}

export function mockConsole(){
  const warn = jest
    .spyOn(console, "warn")
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