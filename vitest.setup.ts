import { expect } from 'vitest';
import * as matchers from '@vitest/browser/matchers';
import { State } from './packages/mvc';

// Add @testing-library matchers for React tests
expect.extend(matchers);

// Add custom State matchers
expect.extend({
  toUpdate,
  toHaveUpdated
});

/**
 * @param {State} received
 * @param {number} timeout
 */
async function toUpdate(received, timeout = 0) {
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

/**
 * @param {State} received
 * @param {string[]} keys
 */
async function toHaveUpdated(received, ...keys) {
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
