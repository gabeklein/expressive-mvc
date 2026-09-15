import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { browserRouter } from '../test.setup';
import { Context } from '@expressive/mvc';
import { BrowserRouter } from './browser';

describe('BrowserRouter', () => {
  const router = browserRouter();

  it('initializes from window.location', () => {
    window.history.replaceState(null, '', '/foo?from=start');
    expect(router.current.path).toBe('/foo');
    expect(router.current.url).toBe('/foo?from=start');
  });

  it('goto pushes history and updates path', () => {
    act(() => router.current.goto('/bar'));
    expect(router.current.path).toBe('/bar');
    expect(window.location.pathname).toBe('/bar');
  });

  it('goto with replace uses replaceState', () => {
    const before = window.history.length;
    act(() => router.current.goto('/replaced', true));
    expect(router.current.path).toBe('/replaced');
    expect(window.location.pathname).toBe('/replaced');
    expect(window.history.length).toBe(before);
  });

  it('updates path on popstate', () => {
    act(() => {
      window.history.pushState(null, '', '/elsewhere');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(router.current.path).toBe('/elsewhere');
  });

  it('notices external history.pushState', () => {
    act(() => window.history.pushState(null, '', '/external'));
    expect(router.current.path).toBe('/external');
  });

  it('goto with query updates location and url', () => {
    act(() => router.current.goto('/results?q=hello'));
    expect(window.location.pathname).toBe('/results');
    expect(window.location.search).toBe('?q=hello');
    expect(router.current.path).toBe('/results');
    expect(router.current.url).toBe('/results?q=hello');
    expect(router.current.query.get('q')).toBe('hello');
  });

  it('clears the query when navigation drops it', () => {
    act(() => router.current.goto('/results?q=hi'));
    act(() => window.history.pushState(null, '', '/results'));
    expect(router.current.url).toBe('/results');
  });

  it('notices external history.replaceState', () => {
    act(() => window.history.replaceState(null, '', '/replaced-external'));
    expect(router.current.path).toBe('/replaced-external');
  });

  it('does not re-push when external navigation uses non-canonical encoding', async () => {
    const len = window.history.length;
    act(() => window.history.pushState(null, '', '/enc?q=a%20b'));
    await router.current.set();

    expect(router.current.query.get('q')).toBe('a b');
    // The query listener must treat %20 and + as equal, not push a corrected dup.
    expect(window.history.length).toBe(len + 1);
  });

  it('writing a query param pushes to window.history', async () => {
    act(() => router.current.goto('/page?x=1'));
    router.current.query.set('x', '9');
    await router.current.set();

    expect(window.location.search).toBe('?x=9');
    expect(window.location.pathname).toBe('/page');
  });

  it('back/forward delegate to window.history', () => {
    const back = vi.spyOn(window.history, 'back');
    const forward = vi.spyOn(window.history, 'forward');

    router.current.back();
    router.current.forward();

    expect(back).toHaveBeenCalledTimes(1);
    expect(forward).toHaveBeenCalledTimes(1);

    back.mockRestore();
    forward.mockRestore();
  });

  it('removes popstate listener on destroy', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    router.current.set(null);
    expect(remove).toHaveBeenCalledWith('popstate', expect.any(Function));
    remove.mockRestore();
  });

  it('is a global on the client', () => {
    expect(Context.root.get(BrowserRouter)).toBe(router.current);
  });

  it('constructs without a window, and is not global there (server render)', () => {
    const saved = (globalThis as any).window;

    try {
      delete (globalThis as any).window;

      const server = BrowserRouter.new();

      expect(server.path).toBe('/');
      // did not register a global - else it would throw on collision with the
      // live client instance
      expect(Context.root.get(BrowserRouter)).toBe(router.current);

      server.set(null);
    } finally {
      (globalThis as any).window = saved;
    }
  });

  it('will throw where window has no location (React Native)', () => {
    const saved = (globalThis as any).window;

    try {
      (globalThis as any).window = Object.create(null);

      expect(typeof window).not.toBe('undefined');
      expect(() => BrowserRouter.new()).toThrow(/pathname/);
    } finally {
      (globalThis as any).window = saved;
    }
  });
});
