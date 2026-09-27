import { afterEach } from 'vitest';

import '../mvc/test.setup';

afterEach(() => {
  document.body.replaceChildren();
});

export { mockError, mockPromise, mockWarn, flushMicrotasks } from '../mvc/test.setup';
