/**
 * Defines MVC specific matchers for [Jest](https://jestjs.io/) test suites.
 *
 * For these to work you will need to add `@expressive/mvc/jest`
 * under `setupFilesAfterEnv` in your Jest configuration.
 */
declare namespace jest {
  interface Matchers<R> {
    /** Assert state does have one or more updates pending. */
    toUpdate(timeout?: number): Promise<R>;

    /** Assert state did update with keys specified. */
    toHaveUpdated<R>(...keys: (string | symbol | number)[]): Promise<R>;
  }

  interface MockPromise<T> extends Promise<T> {
    resolve: (value: T | PromiseLike<T>) => void;
    reject: (reason?: any) => void;
  }

  /** Create a promise with externally accessible resolve/reject methods. */
  function mockPromise<T = void>(): MockPromise<T>;

  /** Create a spy on console.warn with auto-cleanup after each test. */
  function mockWarn(): jest.SpyInstance;

  /** Create a spy on console.error with auto-cleanup after each test. */
  function mockError(): jest.SpyInstance;
}

export {};
