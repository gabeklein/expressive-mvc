export interface MockPromise<T> extends Promise<T> {
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

export function mockWarn(){
  const warn = jest.spyOn(console, "warn");

  afterEach(() => warn.mockReset());
  afterAll(() => warn.mockRestore());

  return warn;
}

export function mockError(){
  const error = jest.spyOn(console, "error");

  error.mockImplementation(() => {});

  afterEach(() => error.mockReset());
  afterAll(() => error.mockRestore());

  return error;
}