import { afterEach, expect } from 'vitest';
import { Context, State } from '@expressive/mvc';
import { listener } from '@expressive/mvc/observable';

interface CustomMatchers<R = unknown> {
  /** Flush pending updates, optionally asserting specific keys were updated. */
  toHaveUpdated(...keys: (string | symbol | number)[]): Promise<R>;
}

declare module 'vitest' {
  interface Matchers<T = any> extends CustomMatchers<T> { }
}

expect.extend({ toHaveUpdated });

afterEach(() => Context.root.pop());

export { flushMicrotasks };

/** Resolve after the task queue drains - flush pending dispatch/effects. */
function flushMicrotasks() {
  return new Promise<void>((r) => setTimeout(r, 0));
}

async function toHaveUpdated(
  received: unknown,
  ...keys: (string | symbol | number)[]
) {
  if (!(received instanceof State))
    return {
      pass: false,
      message: () => `Expected State but got ${received}.`
    };

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

  let didUpdate = await received.set();

  if (!didUpdate.length && !didFlush) await flushMicrotasks();

  remove();

  if (!didUpdate.length) didUpdate = updated;

  if (!didUpdate.length)
    return {
      pass: false,
      message: () => `Expected ${received} to have pending updates.`
    };

  for (const key of keys)
    if (!didUpdate.includes(key))
      return {
        pass: false,
        message: () =>
          `Expected ${received} to have updated keys [${keys
            .map(String)
            .join(', ')}] but got [${didUpdate.join(', ')}].`
      };

  return {
    pass: true,
    message: () => `Expected ${received} not to have pending updates.`
  };
}
