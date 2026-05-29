import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { Router } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('Router', () => {
  it('initializes from window.location', () => {
    window.history.replaceState(null, '', '/foo');
    const router = Router.new({});
    expect(router.path).toBe('/foo');
  });

  it('goto pushes history and updates path', () => {
    const router = Router.new({});
    act(() => router.goto('/bar'));
    expect(router.path).toBe('/bar');
    expect(window.location.pathname).toBe('/bar');
  });

  it('goto with replace uses replaceState', () => {
    const router = Router.new({});
    const before = window.history.length;
    act(() => router.goto('/replaced', true));
    expect(router.path).toBe('/replaced');
    expect(window.location.pathname).toBe('/replaced');
    expect(window.history.length).toBe(before);
  });

  it('updates path on popstate', () => {
    const router = Router.new({});
    act(() => {
      window.history.pushState(null, '', '/elsewhere');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(router.path).toBe('/elsewhere');
  });

  it('notices external history.pushState', () => {
    const router = Router.new({});
    act(() => window.history.pushState(null, '', '/external'));
    expect(router.path).toBe('/external');
  });

  it('notices external history.replaceState', () => {
    const router = Router.new({});
    act(() => window.history.replaceState(null, '', '/replaced-external'));
    expect(router.path).toBe('/replaced-external');
  });

  it('removes popstate listener on destroy', () => {
    const remove = spyOn(window, 'removeEventListener');
    const router = Router.new({});
    router.set(null);
    expect(remove).toHaveBeenCalledWith('popstate', expect.any(Function));
    remove.mockRestore();
  });
});
