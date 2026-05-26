import { mock, spyOn } from 'bun:test';

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

export { mockError, mockPromise, mockWarn } from './test.setup';
