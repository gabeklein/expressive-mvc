import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Context } from '@expressive/mvc';

import { withWindow } from '../test.setup';
import { Route } from './route';
import { BrowserRouter } from './browser';
import { Router } from './router';

const page = () =>
  renderToString(
    <Route to="*">
      <h1>Home</h1>
    </Route>
  );

describe('router SSR probe (no window)', () => {
  it('will render requests independently without registering a root Router', () => {
    const [a, b] = withWindow(undefined, () => {
      expect(typeof window).toBe('undefined');

      const html = [page(), page()];

      expect(Context.root.get(Router, false)).toBeUndefined();
      expect(Context.root.get(BrowserRouter, false)).toBeUndefined();

      return html;
    });

    expect(a).toContain('<h1>Home</h1>');
    expect(b).toBe(a);
  });
});
