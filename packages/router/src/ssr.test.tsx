import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Context } from '@expressive/mvc';

import { Route } from './route';
import { BrowserRouter } from './browser';
import { Router } from './router';

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
  it('will render requests independently without registering a root Router', () => {
    const [a, b] = onServer(() => {
      const html = [
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
      ];

      // client-only global -> nothing registered at root on the server
      expect(Context.root.get(Router, false)).toBeUndefined();
      expect(Context.root.get(BrowserRouter, false)).toBeUndefined();

      return html;
    });
    expect(a).toContain('Home');
    expect(b).toContain('Home');
  });
});
