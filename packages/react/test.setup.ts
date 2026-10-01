import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import { afterEach } from 'vitest';
import { injectIntoGlobalHook } from 'react-refresh/runtime';

import '../mvc/test.setup';

if (!('__REACT_DEVTOOLS_GLOBAL_HOOK__' in window)) injectIntoGlobalHook(window);

const { cleanup } = await import('@testing-library/react');

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

setFlagsFromString('--expose-gc');

const gc: () => void = runInNewContext('gc');

/** Force collection until finalizers have had a turn to run. */
export async function collect() {
  for (let i = 0; i < 5; i++) {
    gc();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export { mockError, mockPromise, mockWarn, flushMicrotasks } from '../mvc/test.setup';
