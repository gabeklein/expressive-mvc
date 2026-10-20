import { describe, expect, it } from 'vitest';
import { idle } from './idle';

const thrower = () => {
  throw new Error();
};

const between = { readContext() {}, useContext: thrower, useState: thrower, useEffect: thrower };
const rendering = { readContext() {}, useContext() {}, useState() {}, useEffect() {} };

describe.each([
  ['React 19', (H: unknown) => ({ __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H } })],
  ['React 16-18', (current: unknown) => ({
    __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: { ReactCurrentDispatcher: { current } }
  })]
])('%s', (_, internals) => {
  it('will be idle without a dispatcher', () => {
    expect(idle(internals(null))()).toBe(true);
  });

  it('will be idle between renders', () => {
    expect(idle(internals(between))()).toBe(true);
  });

  it('will not be idle while rendering', () => {
    expect(idle(internals(rendering))()).toBe(false);
  });
});

it('will not be idle if internals are unrecognised', () => {
  expect(idle({})()).toBe(false);
  expect(idle({ __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: {} })()).toBe(false);
  expect(idle({ __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {} })()).toBe(false);
});
