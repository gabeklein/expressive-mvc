import '@testing-library/jest-dom';

import { State } from '@expressive/mvc';

declare global {
  /**
   * Defines MVC specific matchers for [Jest](https://jestjs.io/) test suites.
   *
   * For these to work you will need to add `@expressive/react/jest`
   * under `setupFilesAfterEnv` in your Jest configuration.
   */
  namespace jest {
    interface Matchers<R> {
      /** Assert state did update with keys specified. */
      toHaveUpdated<R>(...keys: (string | symbol | number)[]): Promise<R>;
    }
  }
}

expect.extend({
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
