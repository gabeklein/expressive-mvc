import { GlobalRegistrator } from '@happy-dom/global-registrator';

if (!GlobalRegistrator.isRegistered) GlobalRegistrator.register();

import { afterEach, mock, spyOn } from 'bun:test';
import { cleanup } from '@testing-library/preact';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

export {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn
} from 'bun:test';

export const vi = {
  fn: <T extends (...args: any[]) => any>(impl?: T) => mock(impl ?? (() => undefined)),
  spyOn
};

export { mockError, mockPromise, mockWarn } from '../state/test.setup';
export {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor
} from '@testing-library/preact';
