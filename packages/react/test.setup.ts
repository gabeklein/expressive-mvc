import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

import '../mvc/test.setup';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

export { mockError, mockPromise, mockWarn, flushMicrotasks } from '../mvc/test.setup';
