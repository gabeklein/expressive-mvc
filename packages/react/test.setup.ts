import { afterEach } from 'bun:test';
import { cleanup } from '@testing-library/react';

import '../state/test.setup';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

export { mockError, mockPromise, mockWarn } from '../state/test.setup';
