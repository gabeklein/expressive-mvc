import { afterEach, describe, it } from 'vitest';
import { cleanup } from '@testing-library/preact';

import '../mvc/test.setup';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

export { mockError, mockPromise, mockWarn, flushMicrotasks } from '../mvc/test.setup';

export const reactOnly = { describe: describe.skip, it: it.skip };

export const preactDiffers = it.fails;
