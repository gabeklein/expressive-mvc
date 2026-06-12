import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';
import { Consumer } from '@expressive/react';

import { location, browserRouter, renderAct } from '../test.setup';
import { Route } from './route';
import { Router } from './router';

const router = browserRouter();

const Home = () => <h1>Home</h1>;
const Post = () => {
  return (
    <Consumer for={Route}>
      {(r) => <article>id: {r.match!.id}</article>}
    </Consumer>
  );
};

/** Render an anonymous root Route over `children`, capturing it, then settle.
 * Returns the captured root plus the view for content assertions. */
async function mount(children: React.ReactNode) {
  let root!: Route;
  const view = render(<Route is={(r) => (root = r)}>{children}</Route>);
  await act(async () => {});
  return { root, view };
}

describe('Route', () => {
  it('mounts the page when its pattern matches', () => {
    const view = render(
      <>
        <Route to="/" as={Home} />
        <Route to="/posts/:id" as={Post} />
      </>
    );
    expect(view.container.textContent).toBe('Home');
  });

  it('does not mount any page when nothing matches', () => {
    location('/unknown');
    const view = render(<Route to="/" as={Home} />);
    expect(view.container.textContent).toBe('');
  });

  it('exposes params from the matched pattern', () => {
    location('/posts/foo');
    const view = render(<Route to="/posts/:id" as={Post} />);
    expect(view.container.textContent).toBe('id: foo');
  });

  it('updates in place on same-pattern navigation (instance persists)', async () => {
    location('/posts/foo');
    let mountCount = 0;

    const Page = () => {
      mountCount++;
      return (
        <Consumer for={Route}>{(r) => <span>{r.match!.id}</span>}</Consumer>
      );
    };

    const view = render(<Route to="/posts/:id" as={Page} />);

    expect(mountCount).toBe(1);
    expect(view.container.textContent).toBe('foo');

    await act(async () => router.current.goto('/posts/bar'));

    expect(mountCount).toBe(1);
    expect(view.container.textContent).toBe('bar');
  });

  it('renders alongside non-Route siblings', () => {
    const view = render(
      <>
        <div>chrome</div>
        <Route to="/" as={Home} />
      </>
    );
    expect(view.container.textContent).toBe('chromeHome');
  });

  it('preserves non-Route children inside a passthrough Route', () => {
    // Non-Route children (elements, text nodes) pass through to the
    // rendered output - structural elements survive resolution.
    const view = render(
      <Route to="/*">
        <div>chrome</div>
        {' text node '}
        <Route to="" as={Home} />
      </Route>
    );
    expect(view.container.textContent).toBe('chrome text node Home');
  });

  it('defaults `as` to a children-passthrough', () => {
    location('/anything');
    const view = render(
      <Route to="/anything">
        <span>inline</span>
      </Route>
    );
    expect(view.container.textContent).toBe('inline');
  });

  it('bare Route (no `to`) is its own root - always on at any path', async () => {
    location('/anything/deep');
    const view = await renderAct(<Route as={Home} />);
    expect(view.container.textContent).toBe('Home');
  });

  it('explicit to="" at root is an index (matches only root)', async () => {
    location('/anything');
    expect((await renderAct(<Route to="" as={Home} />)).container.textContent).toBe('');

    location('/');
    expect((await renderAct(<Route to="" as={Home} />)).container.textContent).toBe('Home');
  });

  it('specific sibling declared first beats bare-default Route', () => {
    location('/about');
    const view = render(
      <Route>
        <Route to="/about" as={() => <span>About</span>} />
        <Route as={() => <span>Fallback</span>} />
      </Route>
    );
    expect(view.container.textContent).toBe('About');
  });

  it('default Route renders when no earlier sibling matches', () => {
    location('/nope');
    const view = render(
      <Route>
        <Route to="/about" as={() => <span>About</span>} />
        <Route default as={() => <span>Fallback</span>} />
      </Route>
    );
    expect(view.container.textContent).toBe('Fallback');
  });

  it('params is undefined when match invalidated by navigation', async () => {
    location('/posts/foo');
    let leaf!: Route;
    render(<Route to="/posts/:id" is={(r) => (leaf = r)} />);
    expect(leaf.match).toEqual({ id: 'foo' });

    await act(async () => router.current.goto('/elsewhere'));
    expect(leaf.match).toBeUndefined();
  });

  it('anchor handles patterns that already end with /', () => {
    let leaf!: Route;
    render(<Route to="/" is={(r) => (leaf = r)} />);
    expect(leaf.anchor).toBe('/');
  });

  it('Route.goto resolves relative paths via anchor', async () => {
    location('/posts/foo');
    let leaf!: Route;
    render(<Route to="/posts/:id" is={(r) => (leaf = r)} />);
    await act(async () => leaf.goto('./edit'));
    expect(window.location.pathname).toBe('/posts/foo/edit');
  });

  it('Route.goto treats empty string and "." as no-op', async () => {
    location('/posts/foo');
    let leaf!: Route;
    render(<Route to="/posts/:id" is={(r) => (leaf = r)} />);
    await act(async () => leaf.goto(''));
    await act(async () => leaf.goto('.'));
    expect(window.location.pathname).toBe('/posts/foo');
  });

  it('Route.goto passes through absolute paths to Router', async () => {
    location('/posts/foo');
    let leaf!: Route;
    render(
      <>
        <Route to="/posts/:id" is={(r) => (leaf = r)} />
        <Route to="/about" as={() => <div>about</div>} />
      </>
    );
    await act(async () => leaf.goto('/about'));
    expect(window.location.pathname).toBe('/about');
  });

  it('Router.goto throws on relative paths', () => {
    expect(() => router.current.goto('./x')).toThrow(/absolute path/);
  });

  it('default `as` renders nothing when given no children', () => {
    location('/blank');
    const view = render(<Route to="/blank" />);
    expect(view.container.textContent).toBe('');
  });

  it('resolves Routes rendered through an intermediate component', () => {
    location('/about');
    const Pages = () => (
      <>
        <Route to="/about" as={() => <span>About</span>} />
        <Route to="/contact" as={() => <span>Contact</span>} />
      </>
    );
    // Wrapping in a Route gives both Routes the same parent for sibling
    // arbitration. The Routes themselves use `get(Route, false)` from
    // context, so resolving through an intermediate component is transparent.
    const view = render(
      <Route>
        <Pages />
      </Route>
    );
    expect(view.container.textContent).toBe('About');
  });

  it('sibling Routes re-resolve winner on navigation', async () => {
    location('/a');
    const view = render(
      <Route>
        <Route to="/a" as={() => <span>A</span>} />
        <Route to="/b" as={() => <span>B</span>} />
      </Route>
    );
    expect(view.container.textContent).toBe('A');
    await act(async () => router.current.goto('/b'));
    expect(view.container.textContent).toBe('B');
  });

  // Blocked on https://github.com/gabeklein/expressive-state/issues/85 -
  // Expressive does not reset omitted props to defaults on prop update, so
  // a winner-swap to a bare Route inherits the prior `to`.
  it.skip('switches between specific and bare-default on navigation', async () => {
    location('/a');
    const view = render(
      <Route>
        <Route to="/a" as={() => <span>A</span>} />
        <Route as={() => <span>Other</span>} />
      </Route>
    );
    expect(view.container.textContent).toBe('A');
    await act(async () => router.current.goto('/b'));
    expect(view.container.textContent).toBe('Other');
  });

  it('parallel Route groups under one parent resolve independently', () => {
    location('/admin/users');
    const Admin = () => (
      <div>
        <Route>
          <Route to="users" as={() => <header>User Header + </header>} />
          <Route as={() => <header>Admin Header + </header>} />
        </Route>
        <Route>
          <Route to="users" as={() => <main>Users Page</main>} />
          <Route to="settings" as={() => <main>Settings Page</main>} />
        </Route>
      </div>
    );
    const view = render(<Route to="admin/*" as={Admin} />);
    expect(view.container.textContent).toBe('User Header + Users Page');
  });

  it('resolves Routes nested in a Fragment', () => {
    location('/about');
    const view = render(
      <Route>
        <>
          <Route to="/about" as={() => <span>About</span>} />
          <Route to="/contact" as={() => <span>Contact</span>} />
        </>
      </Route>
    );
    expect(view.container.textContent).toBe('About');
  });

  describe('declaration order', () => {
    // Specificity-based arbitration (literal > :param > *) is pending.
    // For now, the first matching sibling with `as` wins - users declare
    // more-specific routes before less-specific ones.

    it('literal declared first wins over :param at the same path', () => {
      location('/posts/new');
      const view = render(
        <Route>
          <Route to="/posts/new" as={() => <span>literal</span>} />
          <Route to="/posts/:id" as={() => <span>dynamic</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('literal');
    });

    it(':param declared first wins over * at the same path', () => {
      location('/posts/foo');
      const view = render(
        <Route>
          <Route to="/posts/:id" as={() => <span>dynamic</span>} />
          <Route to="*" as={() => <span>catch-all</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('dynamic');
    });

    it('catch-all matches when no earlier sibling does', () => {
      location('/anything/at/all');
      const view = render(
        <Route>
          <Route to="/" as={() => <span>home</span>} />
          <Route to="*" as={() => <span>not-found</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('not-found');
    });

    it('first declared wins on a true tie', () => {
      location('/posts/foo');
      const view = render(
        <Route>
          <Route to="/posts/:a" as={() => <span>a</span>} />
          <Route to="/posts/:b" as={() => <span>b</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('a');
    });
  });

  describe('passthrough Routes', () => {
    it('do not block sibling Routes from competing for selection', () => {
      // A Route without `as` is a grouping container - it must not
      // prevent its siblings (with `as`) from being chosen.
      location('/about');
      const view = render(
        <Route>
          <Route>
            <Route to="/about" as={() => <span>Grouped</span>} />
          </Route>
          <Route to="/about" as={() => <span>Sibling</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('GroupedSibling');
    });

    it('allow Routes nested inside structural wrapper components', () => {
      // Nested Routes inside an `as` component or children are relative
      // to the enclosing Route via context, not by lexical inspection.
      location('/blog/hello');
      const Layout = (props: { children?: React.ReactNode }) => (
        <main>
          <header>chrome</header>
          <section>{props.children}</section>
        </main>
      );
      const view = render(
        <Route to="/blog/*" as={Layout}>
          <Route to=":id" as={Post} />
        </Route>
      );
      expect(view.container.textContent).toBe('chromeid: hello');
    });
  });

  describe('nested routes', () => {
    const Layout = (props: { children?: React.ReactNode }) => (
      <section><nav>chrome</nav>{props.children}</section>
    );
    const BlogIndex = () => <p>blog-index</p>;
    const BlogPost = () => (
      <Consumer for={Route}>{(r) => <p>post {r.match!.slug}</p>}</Consumer>
    );

    it('layout mounts its prefix-matched child', () => {
      location('/blog');
      const view = render(
        <Route to="/blog/*" as={Layout}>
          <Route to=":slug" as={BlogPost} />
          <Route as={BlogIndex} />
        </Route>
      );
      expect(view.container.textContent).toBe('chromeblog-index');
    });

    it('layout resolves :param child', () => {
      location('/blog/hello');
      const view = render(
        <Route to="/blog/*" as={Layout}>
          <Route to=":slug" as={BlogPost} />
          <Route as={BlogIndex} />
        </Route>
      );
      expect(view.container.textContent).toBe('chromepost hello');
    });

    it('layout does not mount when out of prefix', () => {
      location('/elsewhere');
      const view = render(
        <Route to="/blog/*" as={Layout}>
          <Route as={BlogIndex} />
        </Route>
      );
      expect(view.container.textContent).toBe('');
    });

    it('three-level nesting composes bases correctly', () => {
      location('/admin/users/42');
      const AdminChrome = (props: { children?: React.ReactNode }) => (
        <main>admin/{props.children}</main>
      );
      const UsersChrome = (props: { children?: React.ReactNode }) => (
        <>users/{props.children}</>
      );
      const UserDetail = () => (
        <Consumer for={Route}>{(r) => <span>{r.match!.id}</span>}</Consumer>
      );
      const view = render(
        <Route to="/admin/*" as={AdminChrome}>
          <Route to="users/*" as={UsersChrome}>
            <Route to=":id" as={UserDetail} />
          </Route>
        </Route>
      );
      expect(view.container.textContent).toBe('admin/users/42');
    });

    it('catch-all layout (to="*") nests children at root base', () => {
      location('/about');
      const Chrome = (props: { children?: React.ReactNode }) => (
        <main>{props.children}</main>
      );
      const view = render(
        <Route to="*" as={Chrome}>
          <Route to="/about" as={() => <span>about</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('about');
    });

    it('own captures only - parent params not in child', () => {
      location('/blog/hello');
      let inner!: Route;
      render(
        <Route to="/blog/*" as={Layout}>
          <Route to=":slug" is={(r) => (inner = r)} />
        </Route>
      );
      expect(inner.match).toEqual({ slug: 'hello' });
    });
  });

  describe('redirect prop', () => {
    it('redirects (replacing) when matched', async () => {
      const before = window.history.length;
      await act(async () => {
        render(
          <>
            <Route to="" redirect="/home" />
            <Route to="/home" as={Home} />
          </>
        );
      });
      expect(window.location.pathname).toBe('/home');
      expect(window.history.length).toBe(before);
    });

    it('does not redirect when unmatched', () => {
      location('/elsewhere');
      render(<Route to="" redirect="/home" />);
      expect(window.location.pathname).toBe('/elsewhere');
    });

    it('resolves a relative target against the Route anchor', async () => {
      location('/posts/foo');
      await act(async () => {
        render(
          <>
            <Route to="/posts/:id" redirect="./edit" />
            <Route to="/posts/:id/edit" as={() => null} />
          </>
        );
      });
      expect(window.location.pathname).toBe('/posts/foo/edit');
    });
  });
});

describe('extends', () => {
  it('subclass authors content via render(); base gates on match', () => {
    let ran = 0;
    class Profile extends Route {
      to = 'profile/*';
      render() {
        ran++;
        return <span>profile</span> as any;
      }
    }

    location('/profile');
    const view = render(<Route><Profile /></Route>);
    expect(view.container.textContent).toBe('profile');
    expect(ran).toBe(1);
  });

  it('does not run subclass content when unmatched (lazy children gate)', () => {
    let ran = 0;
    class Profile extends Route {
      to = 'profile/*';
      render() {
        ran++;
        return <span>profile</span> as any;
      }
    }

    location('/elsewhere');
    const view = render(<Route><Profile /></Route>);
    expect(view.container.textContent).toBe('');
    expect(ran).toBe(0); // never invoked while unmatched
  });

  it('subclass owns nested routes that respect its mount path', () => {
    class Profile extends Route {
      to = 'profile/*';
      render() {
        return (
          <>
            <Route to="" as={() => <span>index</span>} />
            <Route to="settings" as={() => <span>settings</span>} />
          </>
        ) as any;
      }
    }

    location('/admin/profile/settings');
    const view = render(
      <Route>
        <Route to="admin/*"><Profile /></Route>
      </Route>
    );
    expect(view.container.textContent).toBe('settings');
  });

  it('is addressable in context by class identity from a descendant', () => {
    let found: Route | undefined;
    class Profile extends Route {
      to = 'profile/*';
      render() {
        return <Inner /> as any;
      }
    }
    const Inner = () => {
      found = Profile.get();
      return <span>ok</span>;
    };

    location('/profile');
    render(<Route><Profile /></Route>);
    expect(found).toBeInstanceOf(Profile);
  });

  describe('structural children', () => {
    it('mounts child Routes even when the parent is unmatched', () => {
      location('/elsewhere');
      let mounted = false;
      const view = render(
        <Route to="foo/*">
          <Route to="bar" is={() => (mounted = true)} as={() => <span>bar</span>} />
        </Route>
      );
      expect(mounted).toBe(true);            // structural child mounted/registered
      expect(view.container.textContent).toBe(''); // ...but invisible (self-gated)
    });

    it('finds child Routes nested in a Fragment', () => {
      location('/elsewhere');
      let mounted = 0;
      render(
        <Route to="foo/*">
          <>
            <Route to="a" is={() => mounted++} />
            <Route to="b" is={() => mounted++} />
          </>
        </Route>
      );
      expect(mounted).toBe(2);               // both mount despite parent unmatched
    });

    it('shows the matched child once the parent matches', () => {
      location('/foo/bar');
      const view = render(
        <Route to="foo/*">
          <Route to="bar" as={() => <span>bar</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('bar');
    });

    it('treats non-Route content as a leaf (gated, not always-mounted)', () => {
      location('/elsewhere');
      let ran = false;
      const Content = () => { ran = true; return <span>content</span>; };
      const view = render(
        <Route to="foo/*">
          <Content />
        </Route>
      );
      expect(ran).toBe(false);               // leaf content gated off while unmatched
      expect(view.container.textContent).toBe('');
    });
  });
});

const ab = (
  <>
    <Route to="a" />
    <Route to="b" />
  </>
);

describe('active', () => {
  it('is undefined when no child matches', async () => {
    Router.new();
    const { root } = await mount(ab);
    expect(root.active).toBeUndefined();
  });

  it('returns the single matched child', async () => {
    router.current.goto('/a');
    const { root } = await mount(ab);
    expect(root.active?.to).toBe('a');
  });

  it('updates on navigation', async () => {
    router.current.goto('/a');
    const { root } = await mount(ab);
    expect(root.active?.to).toBe('a');

    await act(async () => router.current.goto('/b'));
    expect(root.active?.to).toBe('b');
  });

  it('is null when more than one child matches', async () => {
    router.current.goto('/a');
    const { root } = await mount(<><Route to="a" /><Route to="a" /></>);
    expect(root.active).toBeNull();
  });

  it('ignores redirect routes as candidates', async () => {
    router.current.goto('/a');
    let content!: Route;
    const { root } = await mount(
      <>
        <Route to="a" redirect="/a" />
        <Route to="a" is={(r) => (content = r)} />
      </>
    );
    expect(root.active).toBe(content);
  });
});

describe('matches', () => {
  it('is empty when no child matches', async () => {
    Router.new();
    const { root } = await mount(ab);
    expect(root.matches).toEqual([]);
  });

  it('lists the matched child path', async () => {
    router.current.goto('/a');
    const { root } = await mount(ab);
    expect(root.matches).toEqual(['/a']);
  });

  it('lists every match when more than one applies', async () => {
    router.current.goto('/a');
    const { root } = await mount(<><Route to="a" /><Route to="a" /></>);
    expect(root.matches).toEqual(['/a', '/a']);
  });

  it('updates on navigation', async () => {
    router.current.goto('/a');
    const { root } = await mount(ab);
    expect(root.matches).toEqual(['/a']);

    await act(async () => router.current.goto('/b'));
    expect(root.matches).toEqual(['/b']);
  });

  it('excludes redirect routes', async () => {
    router.current.goto('/a');
    const { root } = await mount(
      <>
        <Route to="a" redirect="/a" />
        <Route to="a" />
      </>
    );
    expect(root.matches).toEqual(['/a']);
  });
});

describe('default', () => {
  const aOr404 = (
    <>
      <Route to="a" as={() => <span>a</span>} />
      <Route default as={() => <span>404</span>} />
    </>
  );

  it('matches when no sibling matches (app 404)', async () => {
    router.current.goto('/x');
    const { view } = await mount(aOr404);
    expect(view.container.textContent).toBe('404');

    await act(async () => router.current.goto('/a'));
    expect(view.container.textContent).toBe('a');
  });

  it('yields once a sibling matches and restores on navigation away', async () => {
    router.current.goto('/a');
    const { view } = await mount(aOr404);
    expect(view.container.textContent).toBe('a');

    await act(async () => router.current.goto('/missing'));
    expect(view.container.textContent).toBe('404');
  });

  it('is scoped to its parent (section 404 does not leak)', async () => {
    router.current.goto('/posts/recent');
    const { view } = await mount(
      <>
        <Route to="posts/*">
          <Route to="recent" as={() => <span>recent</span>} />
          <Route default as={() => <span>posts404</span>} />
        </Route>
        <Route default as={() => <span>app404</span>} />
      </>
    );
    expect(view.container.textContent).toBe('recent');

    await act(async () => router.current.goto('/posts/xyz'));
    expect(view.container.textContent).toBe('posts404');

    await act(async () => router.current.goto('/elsewhere'));
    expect(view.container.textContent).toBe('app404');
  });

  it('is excluded from matches and active', async () => {
    router.current.goto('/missing');
    const { root } = await mount(
      <>
        <Route to="a" />
        <Route default as={() => <span>404</span>} />
      </>
    );
    expect(root.matches).toEqual([]);
    expect(root.active).toBeUndefined();
  });

  it('sees through an anonymous group - nested match suppresses sibling default', async () => {
    router.current.goto('/a');
    const { view } = await mount(
      <>
        <Route>
          <Route to="a" as={() => <span>A</span>} />
        </Route>
        <Route default as={() => <span>F</span>} />
      </>
    );
    expect(view.container.textContent).toBe('A');

    await act(async () => router.current.goto('/missing'));
    expect(view.container.textContent).toBe('F');
  });
});
it('match keeps identity when recompute yields equal params', async () => {
  location('/posts/foo');
  let leaf!: Route;
  render(<Route to="/posts/:id" is={(r) => (leaf = r)} />);

  const first = leaf.match;
  expect(first).toEqual({ id: 'foo' });

  // Case-insensitive literal: the path changes (forcing recompute) but the
  // captures are equal, so match returns the previous object - reactive
  // consumers see no change.
  await act(async () => router.current.goto('/POSTS/foo'));
  expect(leaf.match).toBe(first!);
});

it('deregisters a child from parent.inner on unmount', async () => {
  location('/');
  let parent!: Route;

  const view = await renderAct(
    <Route is={(r) => (parent = r)}>
      <Route to="a" />
    </Route>
  );
  expect(parent.inner.map((r) => r.path)).toEqual(['/a']);

  await act(async () => view.rerender(<Route is={(r) => (parent = r)} />));
  expect(parent.inner).toEqual([]);
});
