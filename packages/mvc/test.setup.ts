import { afterAll, afterEach, expect, spyOn } from 'bun:test';
import { Context, State } from './src';
import { listener } from './src/observable';

interface CustomMatchers<R = unknown> {
  /** Flush pending updates, optionally asserting specific keys were updated. */
  toHaveUpdated(...keys: (string | symbol | number)[]): Promise<R>;
  /** Assert a queryable (screen or bound element) has rendered the given text. */
  toHaveText(text: string): R;
}

interface Queryable {
  queryAllByText(text: string): unknown[];
}

declare module 'bun:test' {
  interface Matchers<T> extends CustomMatchers<T> { }
  interface AsymmetricMatchers extends CustomMatchers { }
}

expect.extend({ toHaveUpdated, toHaveText });

afterEach(() => Context.root.pop());

export { mockError, mockPromise, mockWarn };
export type { MockPromise };

async function toHaveUpdated(
  received: unknown,
  ...keys: (string | symbol | number)[]
) {
  if (!(received instanceof State))
    return {
      pass: false,
      message: () => `Expected State but got ${received}.`
    };

  // Eagerly collect keys and detect flush, before any await.
  const updated: string[] = [];
  let didFlush = false;

  const remove = listener(received.is, (key) => {
    if (
      typeof key == 'string' ||
      typeof key == 'number' ||
      typeof key == 'symbol'
    )
      updated.push(key as string);
    else if (key === false) didFlush = true;
  });

  // Check if already pending.
  let didUpdate = await received.set();

  // If nothing was pending, wait for microtask queue to drain fully.
  if (!didUpdate.length && !didFlush)
    await new Promise<void>((r) => setTimeout(r, 0));

  remove();

  if (!didUpdate.length) didUpdate = updated;

  if (!didUpdate.length)
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

function toHaveText(received: unknown, text: string) {
  const query = (received as Queryable)?.queryAllByText;

  if (typeof query != 'function')
    return {
      pass: false,
      message: () =>
        `Expected a queryable (screen or bound element) but got ${received}.`
    };

  const found = query.call(received, text);

  return {
    pass: found.length > 0,
    message: () =>
      found.length
        ? `Expected not to find text "${text}" but found ${found.length}.`
        : `Expected to find text "${text}" but found none.`
  };
}

interface MockPromise<T> extends Promise<T> {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

function mockPromise<T = void>() {
  const methods = {} as MockPromise<T>;
  const promise = new Promise((res, rej) => {
    methods.resolve = res;
    methods.reject = rej;
  }) as MockPromise<T>;

  return Object.assign(promise, methods);
}

type ConsoleSpy = ReturnType<typeof spyOn<Console, 'warn' | 'error'>>;

const SPIES = new Map<'warn' | 'error', ConsoleSpy>();

afterEach(() => SPIES.forEach((spy) => spy.mockClear()));
afterAll(() => {
  SPIES.forEach((spy) => spy.mockRestore());
  SPIES.clear();
});

function spyOnce(method: 'warn' | 'error') {
  let spy = SPIES.get(method);

  if (!spy) {
    spy = spyOn(console, method).mockImplementation(() => { });
    SPIES.set(method, spy);
  }

  return spy;
}

function mockWarn() {
  return spyOnce('warn');
}

function mockError() {
  return spyOnce('error');
}
