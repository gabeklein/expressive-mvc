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
    expect(router.url).toBe('/posts?page=2&sort=asc');
  });

  it('goto without query clears the query', () => {
    const router = Router.new();
    router.goto('/posts?page=2');
    router.goto('/posts');
    expect(router.url).toBe('/posts');
  });

  it('canonicalizes the query so navigation does not push a duplicate entry', async () => {
    const encoded = Router.new();
    encoded.goto('/x?q=a%20b');
    await encoded.set();
    expect(encoded.entries).toEqual(['/', '/x?q=a+b']);

    const repeated = Router.new();
    repeated.goto('/x?a=1&a=2');
    await repeated.set();
    expect(repeated.entries).toEqual(['/', '/x?a=2']);
  });

  it('query exposes params as a record', () => {
    const router = Router.new();
    router.goto('/posts?page=2');
    expect(router.query.page).toBe('2');
  });

  it('subclass may narrow query keys via declare (type-level)', () => {
    class Search extends Router {
      declare query: { q?: string; page?: string };
    }

    const router = Search.new();
    router.goto('/posts?q=hi&page=2');

    // Compile-time: known keys resolve, unknown keys are rejected.
    const q: string | undefined = router.query.q;
    // @ts-expect-error - `nope` is not a declared key
    router.query.nope;

    expect(q).toBe('hi');
    expect(router.query.page).toBe('2');
  });

  it('query updates reactively when search changes', async () => {
    const router = Router.new();
    const seen: (string | undefined)[] = [];

    router.get(state => {
      seen.push(state.query.page);
    });

    router.goto('/posts?page=1');
    await router.set();
    router.goto('/posts?page=2');
    await router.set();

    expect(seen).toEqual([undefined, '1', '2']);
  });

  it('writing a query param pushes a new history entry', async () => {
    const router = Router.new();
    router.goto('/posts?page=1');
    router.query.page = '2';
    await router.set();

    expect(router.url).toBe('/posts?page=2');
    router.back();
    expect(router.url).toBe('/posts?page=1');
  });

  it('deleting a query param navigates', async () => {
    const router = Router.new();
    router.goto('/posts?page=2&sort=asc');
    delete router.query.sort;
    await router.set();

    expect(router.query.sort).toBeUndefined();
    expect(router.path).toBe('/posts');
  });

  it('assigning url navigates (push)', () => {
    const router = Router.new();
    router.goto('/a');
    router.url = '/b?x=1';

    expect(router.path).toBe('/b');
    expect(router.query.x).toBe('1');
    expect(router.entries).toEqual(['/', '/a', '/b?x=1']);
  });

  it('back/forward restore the query from the stack', () => {
    const router = Router.new();
    router.goto('/a?x=1');
    router.goto('/b?y=2');

    router.back();
    expect(router.url).toBe('/a?x=1');

    router.forward();
    expect(router.url).toBe('/b?y=2');
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
    expect(router.current.query.q).toBe('hello');
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

    expect(router.current.query.q).toBe('a b');
    // The query listener must treat %20 and + as equal, not push a corrected dup.
    expect(window.history.length).toBe(len + 1);
  });

  it('writing a query param pushes to window.history', async () => {
    act(() => router.current.goto('/page?x=1'));
    router.current.query.x = '9';
    await router.current.set();

    expect(window.location.search).toBe('?x=9');
    expect(window.location.pathname).toBe('/page');
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
