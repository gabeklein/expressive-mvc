import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, it } from 'vitest';
import { cleanup } from '@testing-library/preact';

import { flushMicrotasks } from '../mvc/test.setup';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

export { mockError, mockPromise, mockWarn, flushMicrotasks, suspender } from '../mvc/test.setup';

/** Force garbage collection until finalizers have had a turn to run. */
export async function collect() {
  setFlagsFromString('--expose-gc');

  const gc: () => void = runInNewContext('gc');

  for (let i = 0; i < 5; i++) {
    gc();
    await flushMicrotasks();
  }
}

export const reactOnly = { describe: describe.skip, it: it.skip };

export const preactDiffers = it.fails;
