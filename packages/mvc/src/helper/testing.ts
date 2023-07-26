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

interface MockAsync {
  /**
   * Promise resolves next invocation of this mock function.
   */
  next(): Promise<void>;
}

export function mockAsync<T = any, Y extends any[] = any>(
  implementation?: (...args: Y) => T){

  const waiting = new Set<() => void>();
  const mock = jest.fn((...args: Y) => {
    waiting.forEach(x => x());
    waiting.clear();

    if(implementation)
      return implementation(...args);
  });

  Object.assign(mock, {
    next(){
      return new Promise<void>(res => {
        waiting.add(res);
      });
    }
  })
  
  return mock as jest.Mock<T, Y> & MockAsync
}

export function mockError(){
  const error = jest
    .spyOn(console, "error")
    .mockImplementation(() => {});

  afterEach(() => error.mockReset());
  afterAll(() => error.mockRestore());

  return error;
}

export function mockWarn(){
  const warn = jest.spyOn(console, "warn");

  afterEach(() => warn.mockReset());
  afterAll(() => warn.mockReset());

  return warn
}

export function timeout(ms?: number){
  return new Promise(res => setTimeout(res, ms));
}