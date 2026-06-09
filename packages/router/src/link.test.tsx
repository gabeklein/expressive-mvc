import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';

import { location, browserRouter } from '../test.setup';
import { Link } from './link';
import { Route } from './route';

const router = browserRouter();

describe('Link', () => {
  it('renders an anchor with the target href', () => {
    const view = render(
      <Route to="/">
        <Link to="/about">about</Link>
      </Route>
    );
    const a = view.container.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('/about');
    expect(a.textContent).toBe('about');
  });

  it('navigates on plain left-click', async () => {
    const view = render(
      <Route to="/">
        <Link to="/about">about</Link>
      </Route>
    );
    await act(async () => {
      fireEvent.click(view.container.querySelector('a')!, { button: 0 });
    });
    expect(router.current.path).toBe('/about');
  });

  it('ignores modifier-clicks (meta/ctrl/shift/alt)', async () => {
    const view = render(
      <Route to="/">
        <Link to="/about">about</Link>
      </Route>
    );
    const a = view.container.querySelector('a')!;
    for (const mod of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey'] as const) {
      await act(async () => {
        fireEvent.click(a, { button: 0, [mod]: true });
      });
      expect(router.current.path).toBe('/');
    }
  });

  it('ignores middle-click (button !== 0)', async () => {
    const view = render(
      <Route to="/">
        <Link to="/about">about</Link>
      </Route>
    );
    await act(async () => {
      fireEvent.click(view.container.querySelector('a')!, { button: 1 });
    });
    expect(router.current.path).toBe('/');
  });

  it('respects defaultPrevented', async () => {
    const view = render(
      <Route to="/">
        <div onClickCapture={(e) => e.preventDefault()}>
          <Link to="/about">about</Link>
        </div>
      </Route>
    );
    await act(async () => {
      fireEvent.click(view.container.querySelector('a')!, { button: 0 });
    });
    expect(router.current.path).toBe('/');
  });

  it('replace=true uses replaceState', async () => {
    const view = render(
      <Route to="/">
        <Link to="/about" replace>about</Link>
      </Route>
    );
    const before = window.history.length;
    await act(async () => {
      fireEvent.click(view.container.querySelector('a')!, { button: 0 });
    });
    expect(router.current.path).toBe('/about');
    expect(window.history.length).toBe(before);
  });

  it('forwards extra anchor props (className, aria, data) but not to/replace', () => {
    const view = render(
      <Route to="/">
        <Link to="/about" replace className="nav" aria-current="page" data-id="x">
          about
        </Link>
      </Route>
    );
    const a = view.container.querySelector('a')!;
    expect(a.getAttribute('class')).toBe('nav');
    expect(a.getAttribute('aria-current')).toBe('page');
    expect(a.getAttribute('data-id')).toBe('x');
    expect(a.hasAttribute('to')).toBe(false);
    expect(a.hasAttribute('replace')).toBe(false);
  });

  it('resolves relative `to` against nearest Route (directory anchor)', async () => {
    location('/posts/foo');
    const view = render(
      <Route to="/posts/:id">
        <Link to="./edit">edit</Link>
      </Route>
    );
    const a = view.container.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('/posts/foo/edit');

    await act(async () => fireEvent.click(a, { button: 0 }));
    expect(router.current.path).toBe('/posts/foo/edit');
  });
});
