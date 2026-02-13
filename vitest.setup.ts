import { expect } from 'vitest';
import { State } from './packages/mvc/src';

// Add @testing-library matchers for React tests
// expect.extend(matchers);

interface CustomMatchers<R = unknown> {
  /** Assert state does have one or more updates pending. */
  toUpdate(timeout?: number): Promise<R>;

  /** Assert state did update with keys specified. */
  toHaveUpdated(...keys: (string | symbol | number)[]): Promise<R>;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

expect.extend({
  toUpdate,
  toHaveUpdated
});

async function toUpdate(received: State, timeout = 0): Promise<any> {
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
}

async function toHaveUpdated(received: State, ...keys: string[]) {
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
