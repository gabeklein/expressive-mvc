import { afterEach, beforeEach } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';

import '../mvc/test.setup';
import { BrowserRouter } from './src/router';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

export { mockError, mockPromise, mockWarn } from '../mvc/test.setup';

/**
 * Opt-in per-test BrowserRouter lifecycle. Call at the top of a describe (or
 * file) that needs one; returns a live handle whose `.router` is refreshed
 * before each test and torn down after.
 */
export function browserRouter() {
  const ctx = {} as { current: BrowserRouter };

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    ctx.current = BrowserRouter.new();
  });

  afterEach(() => ctx.current && ctx.current.set(null));

  return ctx;
}

/** Set the current location without navigating - seeds a test's initial URL. */
export const location = (path: string) => window.history.replaceState(null, '', path);

/** `render` wrapped in `act`, for trees that navigate/settle on mount. */
export async function renderAct(ui: Parameters<typeof render>[0]) {
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(ui); });
  return view;
}
