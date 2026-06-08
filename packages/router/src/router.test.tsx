import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import { BrowserRouter, Router } from './router';

describe('Router (headless)', () => {
  it('defaults to root', () => {
    expect(Router.new().path).toBe('/');
  });

  it('goto updates path in memory', () => {
    const router = Router.new();
    router.goto('/bar');
    expect(router.path).toBe('/bar');
  });

  it('goto normalizes . and ..', () => {
    const router = Router.new();
    router.goto('/posts/foo/../bar');
    expect(router.path).toBe('/posts/bar');
  });

  it('goto throws on relative paths', () => {
    expect(() => Router.new().goto('./x')).toThrow(/absolute path/);
  });

  it('seeds the history stack from the initial path', () => {
    const router = Router.new({ path: '/start' });
    expect(router.entries).toEqual(['/start']);
    expect(router.index).toBe(0);
  });

  it('goto pushes onto the stack; back/forward move the cursor', () => {
    const router = Router.new();
    router.goto('/a');
    router.goto('/b');
    expect(router.entries).toEqual(['/', '/a', '/b']);

    router.back();
    expect(router.path).toBe('/a');
    router.back();
    expect(router.path).toBe('/');
    router.forward();
    expect(router.path).toBe('/a');
  });

  it('goto with replace overwrites the current entry', () => {
    const router = Router.new();
    router.goto('/a');
    router.goto('/b', true);
    expect(router.entries).toEqual(['/', '/b']);
    expect(router.path).toBe('/b');
  });

  it('goto after back truncates the forward history', () => {
    const router = Router.new();
    router.goto('/a');
    router.goto('/b');
    router.back();
    router.goto('/c');
    expect(router.entries).toEqual(['/', '/a', '/c']);
    expect(router.path).toBe('/c');
  });
});

describe('BrowserRouter', () => {
  let router: BrowserRouter;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    router = BrowserRouter.new();
  });

  afterEach(() => {
    router!.set(null);
  });

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
