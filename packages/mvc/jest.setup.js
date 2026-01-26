import { State } from '@expressive/mvc';

expect.extend({
  toUpdate,
  toHaveUpdated
});

// Add custom mock utilities to jest namespace
jest.mockPromise = () => {
  const methods = {};
  const promise = new Promise((res, rej) => {
    methods.resolve = res;
    methods.reject = rej;
  });
  return Object.assign(promise, methods);
};

jest.mockWarn = () => {
  const warn = jest.spyOn(console, 'warn');
  afterEach(() => warn.mockReset());
  afterAll(() => warn.mockRestore());
  return warn;
};

jest.mockError = () => {
  const error = jest.spyOn(console, 'error');
  afterEach(() => error.mockReset());
  afterAll(() => error.mockRestore());
  return error;
};

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
