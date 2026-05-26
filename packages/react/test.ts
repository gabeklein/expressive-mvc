import { createElement, Suspense } from 'react';
import { mock, spyOn } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { Provider, State } from './src';

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

export { mockError, mockPromise, mockWarn } from '../../test.setup';
export { act, render, screen, renderHook, waitFor } from '@testing-library/react';

function renderWith<T>(Type: State.Type | State, hook: () => T) {
  return renderHook(hook, {
    wrapper(props) {
      return createElement(
        Provider,
        { for: Type },
        createElement(Suspense, { fallback: null }, props.children)
      );
    }
  });
}

export { renderWith };
