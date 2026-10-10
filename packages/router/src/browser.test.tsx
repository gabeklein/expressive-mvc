import { act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { browserRouter, location, mockPromise, renderAct, withWindow } from '../test.setup';
import { Context } from '@expressive/mvc';
import { Component } from '@expressive/react';
import { BrowserRouter } from './browser';
import { Route } from './route';

function gate() {
  const promise = Object.assign(mockPromise<void>(), { ready: false });
  promise.then(() => (promise.ready = true));
  return promise;
}

const release = (gate: Promise<void> & { resolve(): void }) =>
  act(async () => {
    gate.resolve();
    await gate;
  });

const step = (fn: () => void) =>
  act(async () => {
    fn();
    await Promise.resolve();
  });

const Status = () => <b>{BrowserRouter.get().navigating ? 'busy' : 'idle'}</b>;

describe('BrowserRouter', () => {
  const router = browserRouter();

  it('initializes from window.location', () => {
    window.history.replaceState(null, '', '/foo?from=start#intro');
    expect(router.current.path).toBe('/foo');
    expect(router.current.hash).toBe('#intro');
    expect(router.current.url).toBe('/foo?from=start#intro');
  });

  it.each([
    ['will push history on goto', false, 1],
    ['will replace history on goto with replace', true, 0]
  ])('%s', async (_, replace, added) => {
    const before = window.history.length;
    await act(async () => router.current.goto('/bar', replace));
    expect(router.current.path).toBe('/bar');
    expect(window.location.pathname).toBe('/bar');
    expect(window.history.length).toBe(before + added);
  });

  it('will update path on popstate', () => {
    act(() => {
      window.history.pushState(null, '', '/elsewhere');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(router.current.path).toBe('/elsewhere');
  });

  it.each([
    ['will notice external history.pushState', 'pushState'],
    ['will notice external history.replaceState', 'replaceState']
  ] as const)('%s', (_, method) => {
    act(() => window.history[method](null, '', '/external#section'));
    expect(router.current.path).toBe('/external');
    expect(router.current.hash).toBe('#section');
  });

  it('will write query and fragment to location on goto', async () => {
    await act(async () => router.current.goto('/results?q=hello#answer'));
    expect(window.location.pathname).toBe('/results');
    expect(window.location.search).toBe('?q=hello');
    expect(window.location.hash).toBe('#answer');
    expect(router.current.url).toBe('/results?q=hello#answer');
    expect(router.current.query.get('q')).toBe('hello');

    act(() => window.history.pushState(null, '', '/results'));
    expect(router.current.url).toBe('/results');
  });

  it('will not re-push when external navigation uses non-canonical encoding', async () => {
    const len = window.history.length;
    act(() => window.history.pushState(null, '', '/enc?q=a%20b'));
    await router.current.set();

    expect(router.current.query.get('q')).toBe('a b');
    expect(window.history.length).toBe(len + 1);
  });

  it('will push to window.history when writing a query param', async () => {
    act(() => router.current.goto('/page?x=1#results'));
    router.current.query.set('x', '9');
    await router.current.set();

    expect(window.location.search).toBe('?x=9');
    expect(window.location.pathname).toBe('/page');
    expect(window.location.hash).toBe('#results');
  });

  it('will push to window.history when writing hash', async () => {
    act(() => router.current.goto('/page?x=1#intro'));
    await router.current.set();
    const before = window.history.length;

    router.current.hash = '#details';
    await router.current.set();

    expect(window.location.pathname).toBe('/page');
    expect(window.location.search).toBe('?x=1');
    expect(window.location.hash).toBe('#details');
    expect(window.history.length).toBe(before + 1);
  });

  it('will synchronize native hash changes', () => {
    act(() => {
      window.location.hash = '#native';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(router.current.hash).toBe('#native');
    expect(router.current.url).toBe('/#native');
  });

  it('will delegate normalized back and go deltas to window.history', () => {
    const go = vi.spyOn(window.history, 'go').mockImplementation(() => {});

    router.current.back();
    router.current.go(2.9);
    router.current.go(0);
    router.current.go(Number.NaN);

    expect(go).toHaveBeenNthCalledWith(1, -1);
    expect(go).toHaveBeenNthCalledWith(2, 2);
    expect(go).toHaveBeenCalledTimes(2);

    go.mockRestore();
  });

  it('will remove history listeners on destroy', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    router.current.set(null);
    expect(remove).toHaveBeenCalledWith('popstate', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('hashchange', expect.any(Function));
    remove.mockRestore();
  });

  it('will be global on the client but not without a window', () => {
    expect(Context.root.get(BrowserRouter)).toBe(router.current);

    withWindow(undefined, () => {
      const server = BrowserRouter.new();
      expect(server.path).toBe('/');
      expect(Context.root.get(BrowserRouter)).toBe(router.current);
      server.set(null);
    });
  });

  it('will throw where window has no location (React Native)', () => {
    withWindow(Object.create(null), () => {
      expect(typeof window).not.toBe('undefined');
      expect(() => BrowserRouter.new()).toThrow(/pathname/);
    });
  });
});

describe('BrowserRouter navigation settlement', () => {
  it('will not report the initial browser synchronization as navigation', () => {
    location('/initial?x=1#intro');
    const router = BrowserRouter.new();

    expect(router.url).toBe('/initial?x=1#intro');
    expect(router.navigating).toBe(false);

    router.set(null);
  });

  it('will keep the latest page and address when navigations settle out of order', async () => {
    location('/');

    const a = gate();
    const b = gate();
    let router!: BrowserRouter;

    const A = () => {
      if (!a.ready) throw a;
      return <h1>a</h1>;
    };
    const B = () => {
      if (!b.ready) throw b;
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

    await step(() => router.goto('/a'));
    await step(() => router.goto('/b'));
    expect(view.container.textContent).toBe('home');
    expect(window.location.pathname).toBe('/');

    await release(b);
    expect(view.container.textContent).toBe('b');
    expect(window.location.pathname).toBe('/b');

    await release(a);
    expect(view.container.textContent).toBe('b');
    expect(window.location.pathname).toBe('/b');
  });

  it('will route direct query writes through navigation settlement', async () => {
    location('/page');

    const pending = gate();
    let router!: BrowserRouter;

    const Page = () => {
      const value = BrowserRouter.get().query.get('x');
      if (value && !pending.ready) throw pending;
      return <h1>{value || 'empty'}</h1>;
    };

    const view = await renderAct(
      <BrowserRouter is={(value) => (router = value)}>
        <Status />
        <Route to="page" as={Page} />
      </BrowserRouter>
    );
    expect(view.container.textContent).toBe('idleempty');

    await step(() => router.query.set('x', '1'));
    expect(view.container.textContent).toBe('busyempty');
    expect(window.location.search).toBe('');

    await release(pending);
    expect(view.container.textContent).toBe('idle1');
    expect(window.location.search).toBe('?x=1');
  });

  it('will report navigation for a provided router', async () => {
    location('/');

    const pending = gate();
    const router = BrowserRouter.new();

    const Slow = () => {
      if (!pending.ready) throw pending;
      return <h1>slow</h1>;
    };

    const view = await renderAct(
      <Component for={router}>
        <Status />
        <Route>
          <Route to="" as={() => <h1>home</h1>} />
          <Route to="slow" as={Slow} />
        </Route>
      </Component>
    );

    await step(() => router.goto('/slow'));
    expect(view.container.textContent).toBe('busyhome');

    await release(pending);
    expect(view.container.textContent).toBe('idleslow');
    router.set(null);
  });

  it('will not let an older goto undo browser-driven navigation', async () => {
    location('/');

    const goto = mockPromise<void>();
    const external = mockPromise<void>();
    const gates = [goto, external];

    class Test extends BrowserRouter {
      static global = false;

      protected navigate(work: () => void) {
        const gate = gates.shift()!;
        gate.then(work);
        return gate;
      }
    }

    const router = Test.new();
    router.goto('/slow');
    window.history.pushState(null, '', '/external');

    expect(router.path).toBe('/');
    expect(window.location.pathname).toBe('/external');

    external.resolve();
    await external;
    await Promise.resolve();

    expect(router.path).toBe('/external');

    goto.resolve();
    await goto;
    await Promise.resolve();

    expect(router.path).toBe('/external');
    expect(window.location.pathname).toBe('/external');

    router.set(null);
  });
});
