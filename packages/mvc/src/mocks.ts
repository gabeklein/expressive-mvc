import { afterAll, afterEach, vi } from 'vitest';

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
  const warn = vi.spyOn(console, "warn");

  afterEach(() => void warn.mockReset());
  afterAll(() => void warn.mockRestore());

  return warn;
}

export function mockError(){
  const error = vi.spyOn(console, "error");

  afterEach(() => void error.mockReset());
  afterAll(() => void error.mockRestore());

  return error;
}