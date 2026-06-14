import { act } from '@testing-library/react';
import { describe, expect, it, spyOn } from 'bun:test';

import { browserRouter } from '../test.setup';
import { Router } from './router';

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

  it('goto splits query string from path', () => {
    const router = Router.new();
    router.goto('/posts?page=2&sort=asc');
    expect(router.path).toBe('/posts');
    expect(router.search).toBe('page=2&sort=asc');
  });

  it('goto without query clears search', () => {
    const router = Router.new();
    router.goto('/posts?page=2');
    router.goto('/posts');
    expect(router.search).toBe('');
  });

  it('query derives URLSearchParams from search', () => {
    const router = Router.new();
    router.goto('/posts?page=2');
    expect(router.query.get('page')).toBe('2');
  });

  it('query updates reactively when search changes', async () => {
    const router = Router.new();
    const seen: (string | null)[] = [];

    router.get(state => {
      seen.push(state.query.get('page'));
    });

    router.goto('/posts?page=1');
    await router.set();
    router.goto('/posts?page=2');
    await router.set();

    expect(seen).toEqual([null, '1', '2']);
  });

  it('back/forward restore search from the stack', () => {
    const router = Router.new();
    router.goto('/a?x=1');
    router.goto('/b?y=2');

    router.back();
    expect(router.path).toBe('/a');
    expect(router.search).toBe('x=1');

    router.forward();
    expect(router.path).toBe('/b');
    expect(router.search).toBe('y=2');
  });

  it('match ignores the query string', () => {
    const router = Router.new();
    router.goto('/posts/123?tab=info');
    expect(router.match('/posts', ':id')).not.toBeNull();
  });
});

describe('BrowserRouter', () => {
  const router = browserRouter();

  it('initializes from window.location', () => {
    window.history.replaceState(null, '', '/foo?from=start');
    expect(router.current.path).toBe('/foo');
    expect(router.current.search).toBe('from=start');
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

  it('goto with query updates location and search', () => {
    act(() => router.current.goto('/results?q=hello'));
    expect(window.location.pathname).toBe('/results');
    expect(window.location.search).toBe('?q=hello');
    expect(router.current.path).toBe('/results');
    expect(router.current.search).toBe('q=hello');
    expect(router.current.query.get('q')).toBe('hello');
  });

  it('clears search when navigation drops the query', () => {
    act(() => router.current.goto('/results?q=hi'));
    act(() => window.history.pushState(null, '', '/results'));
    expect(router.current.search).toBe('');
  });

  it('notices external history.replaceState', () => {
    act(() => window.history.replaceState(null, '', '/replaced-external'));
    expect(router.current.path).toBe('/replaced-external');
  });

  it('back/forward delegate to window.history', () => {
    const back = spyOn(window.history, 'back');
    const forward = spyOn(window.history, 'forward');

    router.current.back();
    router.current.forward();

    expect(back).toHaveBeenCalledTimes(1);
    expect(forward).toHaveBeenCalledTimes(1);

    back.mockRestore();
    forward.mockRestore();
  });

  it('removes popstate listener on destroy', () => {
    const remove = spyOn(window, 'removeEventListener');
    router.current.set(null);
    expect(remove).toHaveBeenCalledWith('popstate', expect.any(Function));
    remove.mockRestore();
  });
});
