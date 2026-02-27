import { createElement, Suspense } from 'react';
export { mockError, mockPromise, mockWarn } from '../../vitest.setup';

import { cleanup, render, renderHook } from '@testing-library/react';
import { afterEach } from 'vitest';
import { Provider, State } from './src';

afterEach(cleanup);

export * from 'vitest';
export * from '@testing-library/react';

function renderWith<T>(Type: State.Type | State, hook: () => T) {
  return renderHook(hook, {
    // reactStrictMode: true,
    wrapper(props) {
      return createElement(
        Provider,
        { for: Type },
        createElement(Suspense, { fallback: null }, props.children)
      );
    }
  });
}

const renderHookStrictly: typeof renderHook = (hook, options) =>
  renderHook(hook, { ...options, reactStrictMode: true });

const renderStrictly: typeof render = (ui: any, options: any): any =>
  render(ui, { ...options, reactStrictMode: true });

export {
  renderWith
  // renderHookStrictly as renderHook,
  // renderStrictly as render
};
