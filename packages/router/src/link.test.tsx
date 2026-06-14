import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';

import { location, browserRouter } from '../test.setup';
import { Link, NavLink } from './link';
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

describe('NavLink', () => {
  it('applies active class when path matches exactly', () => {
    location('/about');
    const view = render(
      <Route to="*">
        <NavLink to="/about">about</NavLink>
      </Route>
    );
    const a = view.container.querySelector('a')!;
    expect(a.getAttribute('class')).toBe('active');
    expect(a.getAttribute('aria-current')).toBe('page');
  });

  it('prefix-matches by default', () => {
    location('/blog/post-1');
    const view = render(
      <Route to="*">
        <NavLink to="/blog">blog</NavLink>
      </Route>
    );
    expect(view.container.querySelector('a')!.getAttribute('class')).toBe('active');
  });

  it('does not match unrelated paths', () => {
    location('/blogging');
    const view = render(
      <Route to="*">
        <NavLink to="/blog">blog</NavLink>
      </Route>
    );
    const a = view.container.querySelector('a')!;
    expect(a.getAttribute('class')).toBe(null);
    expect(a.hasAttribute('aria-current')).toBe(false);
  });

  it('exact disables prefix matching', () => {
    location('/blog/post-1');
    const view = render(
      <Route to="*">
        <NavLink to="/blog" exact>blog</NavLink>
      </Route>
    );
    expect(view.container.querySelector('a')!.getAttribute('class')).toBe(null);
  });

  it('treats a root link as prefix of everything unless exact', () => {
    location('/about');
    const view = render(
      <Route to="*">
        <NavLink to="/">home</NavLink>
        <NavLink to="/" exact>home</NavLink>
      </Route>
    );
    const [loose, strict] = Array.from(view.container.querySelectorAll('a'));
    expect(loose.getAttribute('class')).toBe('active');
    expect(strict.getAttribute('class')).toBe(null);
  });

  it('merges activeClassName with className', () => {
    location('/about');
    const view = render(
      <Route to="*">
        <NavLink to="/about" className="nav" activeClassName="current">about</NavLink>
      </Route>
    );
    expect(view.container.querySelector('a')!.getAttribute('class')).toBe('nav current');
  });

  it('toggles active class across navigation', async () => {
    const view = render(
      <Route to="*">
        <NavLink to="/about">about</NavLink>
      </Route>
    );
    const a = view.container.querySelector('a')!;
    expect(a.getAttribute('class')).toBe(null);

    await act(async () => router.current.goto('/about'));
    expect(a.getAttribute('class')).toBe('active');

    await act(async () => router.current.goto('/'));
    expect(a.getAttribute('class')).toBe(null);
  });

  it('navigates like a Link', async () => {
    const view = render(
      <Route to="*">
        <NavLink to="/about">about</NavLink>
      </Route>
    );
    await act(async () => {
      fireEvent.click(view.container.querySelector('a')!, { button: 0 });
    });
    expect(router.current.path).toBe('/about');
  });
});
