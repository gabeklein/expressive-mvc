// IMPORTANT: happy-dom must register before any @testing-library/* module is
// imported anywhere in the test process. @testing-library/dom captures
// `document.body` at module-load time, and any later registration leaves
// `screen.*` permanently bound to an undefined document. ESM hoists all
// `import` statements, so the testing-library is pulled in via `require()`
// below to defer it until after `register()` has run.
import { GlobalRegistrator } from '@happy-dom/global-registrator';
if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();

import { afterEach } from 'bun:test';
import '../state/test.setup';

const { cleanup } = require('@testing-library/react') as typeof import('@testing-library/react');

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

export { mockError, mockPromise, mockWarn } from '../state/test.setup';
