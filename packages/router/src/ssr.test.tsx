import { describe, it, expect } from 'bun:test';
import { renderToString } from 'react-dom/server';
import { Context } from '@expressive/mvc';

import { Route } from './route';
import { BrowserRouter, Router } from './router';

function onServer<T>(fn: () => T): T {
  const saved = (globalThis as any).window;
  try {
    delete (globalThis as any).window;
    expect(typeof window).toBe('undefined');
    return fn();
  } finally {
    (globalThis as any).window = saved;
  }
}

const Home = () => <h1>Home</h1>;

describe('router SSR probe (no window)', () => {
  it('renders a Route tree without crashing', () => {
    const html = onServer(() =>
      renderToString(
        <Route to="*">
          <Home />
        </Route>
      )
    );
    expect(html).toContain('Home');
  });

  it('does not leave a shared Router in root after a server render', () => {
    onServer(() => {
      renderToString(
        <Route to="*">
          <Home />
        </Route>
      );
      // client-only global -> nothing registered at root on the server
      expect(Context.root.get(Router, false)).toBeUndefined();
      expect(Context.root.get(BrowserRouter, false)).toBeUndefined();
    });
  });

  it('renders two requests independently', () => {
    const [a, b] = onServer(() => [
      renderToString(
        <Route to="*">
          <Home />
        </Route>
      ),
      renderToString(
        <Route to="*">
          <Home />
        </Route>
      )
    ]);
    expect(a).toContain('Home');
    expect(b).toContain('Home');
  });
});
