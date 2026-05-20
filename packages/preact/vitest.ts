export { mockError, mockPromise, mockWarn } from '../../vitest.setup';

import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

afterEach(cleanup);

export * from 'vitest';
export {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor
} from '@testing-library/preact';
