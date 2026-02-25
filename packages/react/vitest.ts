import { createElement, Suspense } from 'react';
export { mockError, mockPromise, mockWarn } from '../../vitest.setup';

import { cleanup, render, renderHook } from '@testing-library/react';
import { afterEach } from 'vitest';
import { Provider, State } from './src';

afterEach(cleanup);

export * from 'vitest';
export * from '@testing-library/react';

function strictlyRenderHook<Result, Props>(
  callback: (props: Props) => Result,
  options?: Parameters<typeof renderHook<Result, Props>>[1]
) {
  return renderHook(callback, { ...options, reactStrictMode: true });
}

function strictlyRender<T>(
  ui: React.ReactElement,
  options?: Parameters<typeof render>[1]
) {
  return render(ui, { ...options, reactStrictMode: true });
}

function renderWith<T>(Type: State.Type | State, hook: () => T) {
  return renderHook(hook, {
    reactStrictMode: true,
    wrapper(props) {
      return createElement(
        Provider,
        { for: Type },
        createElement(Suspense, { fallback: null }, props.children)
      );
    }
  });
}

export {
  renderWith,
  strictlyRenderHook as renderHook,
  strictlyRender as render
};
