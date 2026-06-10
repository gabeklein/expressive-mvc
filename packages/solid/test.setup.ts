import { afterEach } from 'bun:test';
import { cleanup } from '@solidjs/testing-library';

import '../mvc/test.setup';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

export { mockError, mockPromise, mockWarn } from '../mvc/test.setup';
