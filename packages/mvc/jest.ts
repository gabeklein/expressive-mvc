import { State } from './src';

declare global {
  /**
   * Defines MVC specific matchers for [Jest](https://jestjs.io/) test suites.
   *
   * For these to work you will need to add `@expressive/mvc/jest`
   * under `setupFilesAfterEnv` in your Jest configuration.
   */
  namespace jest {
    interface Matchers<R> {
      /** Assert state does have one or more updates pending. */
      toUpdate(timeout?: number): Promise<R>;

      /** Assert state did update with keys specified. */
      toHaveUpdated<R>(...keys: (string | symbol | number)[]): Promise<R>;
    }
  }
}

expect.extend({
  async toUpdate(received: any, timeout = 0) {
    if (!(received instanceof State))
      return {
        pass: false,
        message: () => `Expected State but got ${received}.`
      };

    return new Promise((resolve) => {
      const remove = received.set(() => {
        clearTimeout(timer);
        return () => {
          remove();
          resolve({
            pass: true,
            message: () => `Expected ${received} not to update.`
          });
        };
      });

      const timer = setTimeout(() => {
        remove();
        resolve({
          pass: false,
          message: () => `Expected ${received} to update within ${timeout}ms.`
        });
      }, timeout);
    });
  },
  async toHaveUpdated(received: any, ...keys: (string | symbol | number)[]) {
    if (!(received instanceof State))
      return {
        pass: false,
        message: () => `Expected State but got ${received}.`
      };

    const didUpdate = await received.set();

    if (!didUpdate)
      return {
        pass: false,
        message: () => `Expected ${received} to have pending updates.`
      };

    if (!keys.length)
      return {
        pass: true,
        message: () => `Expected ${received} not to have pending updates.`
      };

    for (const key of keys)
      if (!didUpdate.includes(key))
        return {
          pass: false,
          message: () => {
            return `Expected ${received} to have updated keys [${keys
              .map(String)
              .join(', ')}] but got [${didUpdate.join(', ')}].`;
          }
        };

    return {
      pass: true,
      message: () =>
        `Expected ${received} not to have updated keys [${keys
          .map(String)
          .join(', ')}].`
    };
  }
});

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
  const warn = jest.spyOn(console, 'warn');

  afterEach(() => warn.mockReset());
  afterAll(() => warn.mockRestore());

  return warn;
}

export function mockError() {
  const error = jest.spyOn(console, 'error');

  afterEach(() => error.mockReset());
  afterAll(() => error.mockRestore());

  return error;
}
