import { afterEach } from 'vitest';
import { injectIntoGlobalHook } from 'react-refresh/runtime';

import '../mvc/test.setup';

if (!('__REACT_DEVTOOLS_GLOBAL_HOOK__' in window)) injectIntoGlobalHook(window);

const { cleanup } = await import('@testing-library/react');

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

export { mockError, mockPromise, mockWarn, flushMicrotasks } from '../mvc/test.setup';
