import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { BrowserRouter } from './router';

let router: BrowserRouter;

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  router = BrowserRouter.new();
})

afterEach(() => {
  router!.set(null);
});

describe('Router', () => {
  it('initializes from window.location', () => {
    window.history.replaceState(null, '', '/foo');
    expect(router.path).toBe('/foo');
  });

  it('goto pushes history and updates path', () => {
    act(() => router.goto('/bar'));
    expect(router.path).toBe('/bar');
    expect(window.location.pathname).toBe('/bar');
  });

  it('goto with replace uses replaceState', () => {
    const before = window.history.length;
    act(() => router.goto('/replaced', true));
    expect(router.path).toBe('/replaced');
    expect(window.location.pathname).toBe('/replaced');
    expect(window.history.length).toBe(before);
  });

  it('updates path on popstate', () => {
    act(() => {
      window.history.pushState(null, '', '/elsewhere');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(router.path).toBe('/elsewhere');
  });

  it('notices external history.pushState', () => {
    act(() => window.history.pushState(null, '', '/external'));
    expect(router.path).toBe('/external');
  });

  it('notices external history.replaceState', () => {
    act(() => window.history.replaceState(null, '', '/replaced-external'));
    expect(router.path).toBe('/replaced-external');
  });

  it('removes popstate listener on destroy', () => {
    const remove = spyOn(window, 'removeEventListener');
    router.set(null);
    expect(remove).toHaveBeenCalledWith('popstate', expect.any(Function));
    remove.mockRestore();
  });
});
