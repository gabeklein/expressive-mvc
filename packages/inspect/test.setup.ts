import { afterEach } from 'vitest';

import '../mvc/test.setup';
import { detach } from './src';

afterEach(() => detach());

export { flushMicrotasks, mockError, mockPromise, mockWarn } from '../mvc/test.setup';
