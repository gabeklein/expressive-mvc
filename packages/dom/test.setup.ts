import { afterEach, vi } from 'vitest';

import '../mvc/test.setup';

afterEach(() => {
  document.body.replaceChildren();
});

export { mockError, mockPromise, mockWarn, flushMicrotasks } from '../mvc/test.setup';

export const until = <T>(assert: () => T) => vi.waitFor(assert, { interval: 1 });
