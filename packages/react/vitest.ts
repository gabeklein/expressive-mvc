import '@testing-library/jest-dom/vitest';

import { afterEach, afterAll, vi } from 'vitest';

interface CustomMatchers<R = unknown> {
  /** Assert state did update with keys specified. */
  toHaveUpdated(...keys: (string | symbol | number)[]): Promise<R>;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

export interface MockPromise<T> extends Promise<T> {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

export function mockPromise<T = void>() {
  const methods = {} as MockPromise<T>;
  const promise = new Promise((res, rej) => {
    methods.resolve = res;
    methods.reject = rej;
  }) as MockPromise<T>;

  return Object.assign(promise, methods);
}

export function mockWarn() {
  const warn = vi.spyOn(console, 'warn');

  afterEach(() => warn.mockReset());
  afterAll(() => warn.mockRestore());

  return warn;
}

export function mockError() {
  const error = vi.spyOn(console, 'error');

  afterEach(() => error.mockReset());
  afterAll(() => error.mockRestore());

  return error;
}

export * from 'vitest';
export * from '@testing-library/react';
