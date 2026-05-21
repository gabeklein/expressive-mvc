import { fireEvent } from '@testing-library/react';

import { act, beforeEach, describe, expect, it, render } from '../vitest';

import { Link } from './link';
import { Route } from './route';
import { Router } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('Link', () => {
  it('renders an anchor with the target href', () => {
    const view = render(
      <Router>
        <Route to="/">
          <Link to="/about">about</Link>
        </Route>
      </Router>
    );
    const a = view.container.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('/about');
    expect(a.textContent).toBe('about');
  });

  it('navigates on plain left-click', async () => {
    let router!: Router;
    const view = render(
      <Router is={(r) => (router = r)}>
        <Route to="/">
          <Link to="/about">about</Link>
        </Route>
      </Router>
    );
    await act(async () => {
      fireEvent.click(view.container.querySelector('a')!, { button: 0 });
    });
    expect(router.path).toBe('/about');
  });

  it('ignores modifier-clicks (meta/ctrl/shift/alt)', async () => {
    let router!: Router;
    const view = render(
      <Router is={(r) => (router = r)}>
        <Route to="/">
          <Link to="/about">about</Link>
        </Route>
      </Router>
    );
    const a = view.container.querySelector('a')!;
    for (const mod of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) {
      await act(async () => {
        fireEvent.click(a, { button: 0, [mod]: true });
      });
      expect(router.path).toBe('/');
    }
  });

  it('ignores middle-click (button !== 0)', async () => {
    let router!: Router;
    const view = render(
      <Router is={(r) => (router = r)}>
        <Route to="/">
          <Link to="/about">about</Link>
        </Route>
      </Router>
    );
    await act(async () => {
      fireEvent.click(view.container.querySelector('a')!, { button: 1 });
    });
    expect(router.path).toBe('/');
  });

  it('respects defaultPrevented', async () => {
    let router!: Router;
    const view = render(
      <Router is={(r) => (router = r)}>
        <Route to="/">
          <div
            onClickCapture={(e) => e.preventDefault()}
          >
            <Link to="/about">about</Link>
          </div>
        </Route>
      </Router>
    );
    await act(async () => {
      fireEvent.click(view.container.querySelector('a')!, { button: 0 });
    });
    expect(router.path).toBe('/');
  });

  it('replace=true uses replaceState', async () => {
    let router!: Router;
    const view = render(
      <Router is={(r) => (router = r)}>
        <Route to="/">
          <Link to="/about" replace>about</Link>
        </Route>
      </Router>
    );
    const before = window.history.length;
    await act(async () => {
      fireEvent.click(view.container.querySelector('a')!, { button: 0 });
    });
    expect(router.path).toBe('/about');
    expect(window.history.length).toBe(before);
  });

  it('resolves relative `to` against nearest Route (directory anchor)', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let router!: Router;
    const view = render(
      <Router is={(r) => (router = r)}>
        <Route to="/posts/:id">
          <Link to="./edit">edit</Link>
        </Route>
      </Router>
    );
    const a = view.container.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('/posts/foo/edit');

    await act(async () => fireEvent.click(a, { button: 0 }));
    expect(router.path).toBe('/posts/foo/edit');
  });

});
