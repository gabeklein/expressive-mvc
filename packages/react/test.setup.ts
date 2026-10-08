import { afterEach, describe, it } from 'vitest';
import { injectIntoGlobalHook } from 'react-refresh/runtime';

import '../mvc/test.setup';

if (!('__REACT_DEVTOOLS_GLOBAL_HOOK__' in window)) injectIntoGlobalHook(window);

const { cleanup } = await import('@testing-library/react');

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

export { mockError, mockPromise, mockWarn, flushMicrotasks } from '../mvc/test.setup';

/** React behavior preact lacks - skipped when packages/preact runs this suite. */
export const reactOnly = { describe, it };

/** React behavior preact handles differently - runs as `it.fails` under packages/preact. */
export const preactDiffers = it;
