import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'bun:test';

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

  it('will call consumer onClick before navigating', async () => {
    let clicked = false;
    const view = render(
      <Route to="/">
        <Link to="/about" onClick={() => (clicked = true)}>
          about
        </Link>
      </Route>
    );
    await act(async () => {
      fireEvent.click(view.container.querySelector('a')!, { button: 0 });
    });
    expect(clicked).toBe(true);
    expect(router.current.path).toBe('/about');
  });

  it('will not navigate if consumer onClick prevents default', async () => {
    const view = render(
      <Route to="/">
        <Link to="/about" onClick={(e) => e.preventDefault()}>
          about
        </Link>
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
        <Link to="/about" replace>
          about
        </Link>
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
        <Link
          to="/about"
          replace
          className="nav"
          aria-current="page"
          data-id="x">
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

describe('Link.match / Link.active', () => {
  /** Counts renders so laziness can be asserted - reset per test. */
  let renders = 0;

  /** Intended consumption: a subclass authors its own render (which fully
   * replaces Link's anchor) and reads `active`/`match` to express activeness
   * however the host wants - here a className plus a probe attribute. */
  class NavLink extends Link {
    render() {
      renders++;
      return (
        <a
          href={this.href}
          onClick={this.go}
          className={this.active ? 'active' : undefined}
          data-match={String(this.match)}>
          {this.props.children}
        </a>
      );
    }
  }
  beforeEach(() => {
    renders = 0;
  });

  it('match is true on an exact path', () => {
    location('/about');
    const view = render(
      <Route to="*">
        <NavLink to="/about">about</NavLink>
      </Route>
    );
    const a = view.container.querySelector('a')!;
    expect(a.getAttribute('data-match')).toBe('true');
    expect(a.getAttribute('class')).toBe('active');
  });

  it('match is false on a prefix-only path', () => {
    location('/blog/post-1');
    const view = render(
      <Route to="*">
        <NavLink to="/blog">blog</NavLink>
      </Route>
    );
    const a = view.container.querySelector('a')!;
    expect(a.getAttribute('data-match')).toBe('false');
    expect(a.getAttribute('class')).toBe('active');
  });

  it('match is undefined on an unrelated path (no false prefix)', () => {
    location('/blogging');
    const view = render(
      <Route to="*">
        <NavLink to="/blog">blog</NavLink>
      </Route>
    );
    const a = view.container.querySelector('a')!;
    expect(a.getAttribute('data-match')).toBe('undefined');
    expect(a.getAttribute('class')).toBe(null);
  });

  it('treats a root link as prefix of everything', () => {
    location('/about');
    const view = render(
      <Route to="*">
        <NavLink to="/">home</NavLink>
      </Route>
    );
    expect(view.container.querySelector('a')!.getAttribute('data-match')).toBe(
      'false'
    );
  });

  it('toggles across navigation when read in render', async () => {
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

  it('re-renders on navigation only because render reads active', async () => {
    render(
      <Route to="*">
        <NavLink to="/about">about</NavLink>
      </Route>
    );
    expect(renders).toBe(1);

    await act(async () => router.current.goto('/about'));
    expect(renders).toBe(2);
  });

  it('does NOT re-render a Link that reads neither (lazy subscription)', async () => {
    /** Reads neither `active` nor `match`, so it must stay inert across navigation. */
    class PlainLink extends Link {
      render(props = {} as Link.Props) {
        renders++;
        return super.render(props);
      }
    }

    render(
      <Route to="*">
        <PlainLink to="/about">about</PlainLink>
      </Route>
    );
    expect(renders).toBe(1);

    await act(async () => router.current.goto('/about'));
    expect(renders).toBe(1);
  });
});
