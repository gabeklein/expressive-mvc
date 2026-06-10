import { act, render } from '@testing-library/react';
import { describe, expect, it, spyOn } from 'bun:test';
import { Provider } from '@expressive/react';

import { browserRouter, location, mockPromise } from '../test.setup';
import { Route } from './route';
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

describe('transition seam (deferred-presentation emit protocol)', () => {
  it('updates path silently, then emits one synchronous path event', () => {
    const router = Router.new();
    const seen: string[] = [];

    router.set((key) => {
      if (key === 'path') seen.push(router.path);
    });

    router.goto('/x'); // synchronous - no act/await

    // emitted exactly once, and `path` already holds the new value at emit time
    expect(seen).toEqual(['/x']);
  });

  it('does not emit when navigating to the unchanged current path', () => {
    const router = Router.new();
    router.goto('/a');

    let count = 0;
    router.set((key) => {
      if (key === 'path') count++;
    });

    router.goto('/a'); // same path - faithful no-op notify
    expect(count).toBe(0);
  });

  it('recomputes match off the new path under the explicit emit', async () => {
    const router = Router.new();
    const view = render(
      <Provider for={router}>
        <Route to="/a" as={() => <span>A</span>} />
        <Route to="/b" as={() => <span>B</span>} />
      </Provider>
    );

    await act(async () => router.goto('/a'));
    expect(view.container.textContent).toBe('A');

    // a stale match cache would keep 'A'; recompute off the new path yields 'B'
    await act(async () => router.goto('/b'));
    expect(view.container.textContent).toBe('B');
  });
});

describe('pending (deferred presentation)', () => {
  // BLOCKED on Suspense boundary placement (FEATURE.md §8): each Route is its own
  // Component with its own auto-Suspense boundary, so the incoming page suspends
  // in a *different* boundary than the outgoing content lives in - React shows the
  // new boundary's fallback (empty) instead of holding the old screen, and the
  // transition completes immediately so `pending` never sustains. Needs a shared
  // boundary at the matched-content site. Un-skip once that lands.
  it.skip('holds the current screen and flips pending while the next suspends', async () => {
    location('/a');

    const ready = mockPromise<void>();
    let done = false;
    ready.then(() => { done = true; });

    const Slow = () => {
      if (!done) throw ready; // suspend until resolved
      return <span>B</span>;
    };

    let router!: BrowserRouter;
    const view = render(
      <BrowserRouter is={(r) => (router = r)}>
        <Route to="/a" as={() => <span>A</span>} />
        <Route to="/b" as={Slow} />
      </BrowserRouter>
    );
    await act(async () => {});

    expect(view.container.textContent).toBe('A');
    expect(router.pending).toBe(false);

    // navigate into the suspending page: deferral holds 'A', no fallback flash
    await act(async () => { router.goto('/b'); });
    expect(router.pending).toBe(true);
    expect(view.container.textContent).toBe('A');

    // resolve: the new page commits and pending clears
    await act(async () => { ready.resolve(); });
    expect(router.pending).toBe(false);
    expect(view.container.textContent).toBe('B');
  });
});

describe('BrowserRouter', () => {
  const router = browserRouter();

  it('initializes from window.location', () => {
    window.history.replaceState(null, '', '/foo');
    expect(router.current.path).toBe('/foo');
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

  it('notices external history.replaceState', () => {
    act(() => window.history.replaceState(null, '', '/replaced-external'));
    expect(router.current.path).toBe('/replaced-external');
  });

  it('removes popstate listener on destroy', () => {
    const remove = spyOn(window, 'removeEventListener');
    router.current.set(null);
    expect(remove).toHaveBeenCalledWith('popstate', expect.any(Function));
    remove.mockRestore();
  });
});
