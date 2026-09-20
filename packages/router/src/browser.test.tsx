import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { browserRouter, location, mockPromise, renderAct } from '../test.setup';
import { Context } from '@expressive/mvc';
import { Provider } from '@expressive/react';
import { BrowserRouter } from './browser';
import { Route } from './route';

describe('BrowserRouter', () => {
  const router = browserRouter();

  it('initializes from window.location', () => {
    window.history.replaceState(null, '', '/foo?from=start');
    expect(router.current.path).toBe('/foo');
    expect(router.current.url).toBe('/foo?from=start');
  });

  it('goto pushes history and updates path', async () => {
    await act(async () => router.current.goto('/bar'));
    expect(router.current.path).toBe('/bar');
    expect(window.location.pathname).toBe('/bar');
  });

  it('goto with replace uses replaceState', async () => {
    const before = window.history.length;
    await act(async () => router.current.goto('/replaced', true));
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

  it('goto with query updates location and url', async () => {
    await act(async () => router.current.goto('/results?q=hello'));
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

describe('navigation settlement', () => {
  it('does not report the initial browser synchronization as navigation', () => {
    location('/initial?x=1');
    const router = BrowserRouter.new();

    expect(router.url).toBe('/initial?x=1');
    expect(router.navigating).toBe(false);

    router.set(null);
  });

  it('keeps the latest page and address when navigations settle out of order', async () => {
    location('/');

    const a = mockPromise<void>();
    const b = mockPromise<void>();
    let readyA = false;
    let readyB = false;
    let router!: BrowserRouter;
    a.then(() => (readyA = true));
    b.then(() => (readyB = true));

    const A = () => {
      if (!readyA) throw a;
      return <h1>a</h1>;
    };
    const B = () => {
      if (!readyB) throw b;
      return <h1>b</h1>;
    };

    const view = await renderAct(
      <BrowserRouter is={(value) => (router = value)}>
        <Route>
          <Route to="" as={() => <h1>home</h1>} />
          <Route to="a" fallback={<i>loading</i>} as={A} />
          <Route to="b" fallback={<i>loading</i>} as={B} />
        </Route>
      </BrowserRouter>
    );

    await act(async () => {
      router.goto('/a');
      await Promise.resolve();
    });
    await act(async () => {
      router.goto('/b');
      await Promise.resolve();
    });

    expect(view.container.textContent).toBe('home');
    expect(window.location.pathname).toBe('/');

    await act(async () => {
      b.resolve();
      await b;
    });

    expect(view.container.textContent).toBe('b');
    expect(window.location.pathname).toBe('/b');

    await act(async () => {
      a.resolve();
      await a;
    });

    expect(view.container.textContent).toBe('b');
    expect(window.location.pathname).toBe('/b');
  });

  it('routes direct query writes through navigation settlement', async () => {
    location('/page');

    const gate = mockPromise<void>();
    let ready = false;
    let router!: BrowserRouter;
    gate.then(() => (ready = true));

    const Page = () => {
      const value = BrowserRouter.get().query.get('x');
      if (value && !ready) throw gate;
      return <h1>{value || 'empty'}</h1>;
    };
    const Status = () => <b>{BrowserRouter.get().navigating ? 'busy' : 'idle'}</b>;

    const view = await renderAct(
      <BrowserRouter is={(value) => (router = value)}>
        <Status />
        <Route to="page" as={Page} />
      </BrowserRouter>
    );

    expect(view.container.textContent).toBe('idleempty');

    await act(async () => {
      router.query.set('x', '1');
      await Promise.resolve();
    });

    expect(view.container.textContent).toBe('busyempty');
    expect(window.location.search).toBe('');

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(view.container.textContent).toBe('idle1');
    expect(window.location.search).toBe('?x=1');
  });

  it('reports navigation for a provided router', async () => {
    location('/');

    const gate = mockPromise<void>();
    let ready = false;
    gate.then(() => (ready = true));
    const router = BrowserRouter.new();

    const Slow = () => {
      if (!ready) throw gate;
      return <h1>slow</h1>;
    };
    const Status = () => <b>{BrowserRouter.get().navigating ? 'busy' : 'idle'}</b>;

    const view = await renderAct(
      <Provider for={router}>
        <Status />
        <Route>
          <Route to="" as={() => <h1>home</h1>} />
          <Route to="slow" as={Slow} />
        </Route>
      </Provider>
    );

    await act(async () => {
      router.goto('/slow');
      await Promise.resolve();
    });

    expect(view.container.textContent).toBe('busyhome');

    await act(async () => {
      gate.resolve();
      await gate;
    });

    expect(view.container.textContent).toBe('idleslow');
    router.set(null);
  });

  it('does not let an older goto undo browser-driven navigation', async () => {
    location('/');

    const goto = mockPromise<void>();
    const external = mockPromise<void>();
    const gates = [goto, external];

    class Test extends BrowserRouter {
      static global = false;

      protected navigate(work: () => void) {
        work();
        return gates.shift()!;
      }
    }

    const router = Test.new();
    router.goto('/slow');
    window.history.pushState(null, '', '/external');

    expect(router.path).toBe('/external');
    expect(window.location.pathname).toBe('/external');

    external.resolve();
    await external;
    await Promise.resolve();
    goto.resolve();
    await goto;
    await Promise.resolve();

    expect(router.path).toBe('/external');
    expect(window.location.pathname).toBe('/external');

    router.set(null);
  });
});
