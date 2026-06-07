import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'bun:test';
import { Consumer, Context } from '@expressive/react';

import { Route } from './route';
import { Router } from './router';

beforeEach(() => {
  Context.root.get(Router, false)?.set(null);
  window.history.replaceState(null, '', '/');
});

const Home = () => <h1>Home</h1>;
const Post = () => {
  return (
    <Consumer for={Route}>
      {(r) => <article>id: {r.match!.id}</article>}
    </Consumer>
  );
};

describe('Route', () => {
  it('mounts the page when its pattern matches', () => {
    window.history.replaceState(null, '', '/');
    const view = render(
      <>
        <Route to="/" as={Home} />
        <Route to="/posts/:id" as={Post} />
      </>
    );
    expect(view.container.textContent).toBe('Home');
  });

  it('does not mount any page when nothing matches', () => {
    window.history.replaceState(null, '', '/unknown');
    const view = render(<Route to="/" as={Home} />);
    expect(view.container.textContent).toBe('');
  });

  it('exposes params from the matched pattern', () => {
    window.history.replaceState(null, '', '/posts/foo');
    const view = render(<Route to="/posts/:id" as={Post} />);
    expect(view.container.textContent).toBe('id: foo');
  });

  it('updates in place on same-pattern navigation (instance persists)', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let mountCount = 0;

    const Page = () => {
      mountCount++;
      return (
        <Consumer for={Route}>{(r) => <span>{r.match!.id}</span>}</Consumer>
      );
    };

    const router = Router.new();
    const view = render(<Route to="/posts/:id" as={Page} />);

    expect(mountCount).toBe(1);
    expect(view.container.textContent).toBe('foo');

    await act(async () => router.goto('/posts/bar'));

    expect(mountCount).toBe(1);
    expect(view.container.textContent).toBe('bar');
  });

  it('renders alongside non-Route siblings', () => {
    window.history.replaceState(null, '', '/');
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
    window.history.replaceState(null, '', '/');
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
    window.history.replaceState(null, '', '/anything');
    const view = render(
      <Route to="/anything">
        <span>inline</span>
      </Route>
    );
    expect(view.container.textContent).toBe('inline');
  });

  it('matches when `to` is omitted (defaults to catch-all)', () => {
    window.history.replaceState(null, '', '/');
    const view = render(<Route as={Home} />);
    expect(view.container.textContent).toBe('Home');
  });

  it('bare Route matches non-root paths (catch-all default)', () => {
    window.history.replaceState(null, '', '/anything/at/all');
    const view = render(<Route as={Home} />);
    expect(view.container.textContent).toBe('Home');
  });

  it('specific sibling declared first beats bare-default Route', () => {
    window.history.replaceState(null, '', '/about');
    const view = render(
      <Route>
        <Route to="/about" as={() => <span>About</span>} />
        <Route as={() => <span>Fallback</span>} />
      </Route>
    );
    expect(view.container.textContent).toBe('About');
  });

  it('bare-default Route renders when no earlier sibling matches', () => {
    window.history.replaceState(null, '', '/nope');
    const view = render(
      <Route>
        <Route to="/about" as={() => <span>About</span>} />
        <Route as={() => <span>Fallback</span>} />
      </Route>
    );
    expect(view.container.textContent).toBe('Fallback');
  });

  it('params returns stable identity when match recomputes to equal content', () => {
    const getter = Object.getOwnPropertyDescriptor(Route.prototype, 'match')!.get!;
    let match: { params: Record<string, string>; score: number } | null = null;
    const stub = {
      base: '',
      to: '/x',
      router: { match: () => match }
    } as unknown as Route;

    match = { params: { id: 'foo' }, score: 110 };
    const first = getter.call(stub);
    expect(first).toEqual({ id: 'foo' });

    match = { params: { id: 'foo' }, score: 110 };
    expect(getter.call(stub)).toBe(first);

    match = { params: { id: 'bar' }, score: 110 };
    const third = getter.call(stub);
    expect(third).not.toBe(first);
    expect(third).toEqual({ id: 'bar' });

    match = null;
    expect(getter.call(stub)).toBeUndefined();
    expect(getter.call(stub)).toBeUndefined();
  });

  it('params is undefined when match invalidated by navigation', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let leaf!: Route;
    const Page = () => (
      <Consumer for={Route}>{(r) => void (leaf = r)}</Consumer>
    );
    const router = Router.new();
    render(<Route to="/posts/:id" as={Page} />);
    expect(leaf.match).toEqual({ id: 'foo' });

    await act(async () => router.goto('/elsewhere'));
    expect(leaf.match).toBeUndefined();
  });

  it('anchor handles patterns that already end with /', async () => {
    window.history.replaceState(null, '', '/');
    let leaf!: Route;
    const Page = () => (
      <Consumer for={Route}>{(r) => void (leaf = r)}</Consumer>
    );
    render(<Route to="/" as={Page} />);
    expect(leaf.anchor).toBe('/');
  });

  it('Route.goto resolves relative paths via anchor', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let leaf!: Route;
    const Page = () => (
      <Consumer for={Route}>{(r) => void (leaf = r)}</Consumer>
    );
    render(<Route to="/posts/:id" as={Page} />);
    await act(async () => leaf.goto('./edit'));
    expect(window.location.pathname).toBe('/posts/foo/edit');
  });

  it('Route.goto treats empty string and "." as no-op', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let leaf!: Route;
    const Page = () => (
      <Consumer for={Route}>{(r) => void (leaf = r)}</Consumer>
    );
    render(<Route to="/posts/:id" as={Page} />);
    await act(async () => leaf.goto(''));
    await act(async () => leaf.goto('.'));
    expect(window.location.pathname).toBe('/posts/foo');
  });

  it('Route.goto passes through absolute paths to Router', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let leaf!: Route;
    const Page = () => (
      <Consumer for={Route}>{(r) => void (leaf = r)}</Consumer>
    );
    render(
      <>
        <Route to="/posts/:id" as={Page} />
        <Route to="/about" as={() => <div>about</div>} />
      </>
    );
    await act(async () => leaf.goto('/about'));
    expect(window.location.pathname).toBe('/about');
  });

  it('Router.goto throws on relative paths', () => {
    const router = Router.new();
    expect(() => router.goto('./x')).toThrow(/absolute path/);
  });

  it('default `as` renders nothing when given no children', () => {
    window.history.replaceState(null, '', '/blank');
    const view = render(<Route to="/blank" />);
    expect(view.container.textContent).toBe('');
  });

  it('resolves Routes rendered through an intermediate component', () => {
    window.history.replaceState(null, '', '/about');
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
    window.history.replaceState(null, '', '/a');
    const router = Router.new();
    const view = render(
      <Route>
        <Route to="/a" as={() => <span>A</span>} />
        <Route to="/b" as={() => <span>B</span>} />
      </Route>
    );
    expect(view.container.textContent).toBe('A');
    await act(async () => router.goto('/b'));
    expect(view.container.textContent).toBe('B');
  });

  // Blocked on https://github.com/gabeklein/expressive-state/issues/85 -
  // Expressive does not reset omitted props to defaults on prop update, so
  // a winner-swap to a bare Route inherits the prior `to`.
  it.skip('switches between specific and bare-default on navigation', async () => {
    window.history.replaceState(null, '', '/a');
    const router = Router.new();
    const view = render(
      <Route>
        <Route to="/a" as={() => <span>A</span>} />
        <Route as={() => <span>Other</span>} />
      </Route>
    );
    expect(view.container.textContent).toBe('A');
    await act(async () => router.goto('/b'));
    expect(view.container.textContent).toBe('Other');
  });

  it('parallel Route groups under one parent resolve independently', () => {
    window.history.replaceState(null, '', '/admin/users');
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
    window.history.replaceState(null, '', '/about');
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
      window.history.replaceState(null, '', '/posts/new');
      const view = render(
        <Route>
          <Route to="/posts/new" as={() => <span>literal</span>} />
          <Route to="/posts/:id" as={() => <span>dynamic</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('literal');
    });

    it(':param declared first wins over * at the same path', () => {
      window.history.replaceState(null, '', '/posts/foo');
      const view = render(
        <Route>
          <Route to="/posts/:id" as={() => <span>dynamic</span>} />
          <Route to="*" as={() => <span>catch-all</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('dynamic');
    });

    it('catch-all matches when no earlier sibling does', () => {
      window.history.replaceState(null, '', '/anything/at/all');
      const view = render(
        <Route>
          <Route to="/" as={() => <span>home</span>} />
          <Route to="*" as={() => <span>not-found</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('not-found');
    });

    it('first declared wins on a true tie', () => {
      window.history.replaceState(null, '', '/posts/foo');
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
      window.history.replaceState(null, '', '/about');
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
      window.history.replaceState(null, '', '/blog/hello');
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
      window.history.replaceState(null, '', '/blog');
      const view = render(
        <Route to="/blog/*" as={Layout}>
          <Route to=":slug" as={BlogPost} />
          <Route as={BlogIndex} />
        </Route>
      );
      expect(view.container.textContent).toBe('chromeblog-index');
    });

    it('layout resolves :param child', () => {
      window.history.replaceState(null, '', '/blog/hello');
      const view = render(
        <Route to="/blog/*" as={Layout}>
          <Route to=":slug" as={BlogPost} />
          <Route as={BlogIndex} />
        </Route>
      );
      expect(view.container.textContent).toBe('chromepost hello');
    });

    it('layout does not mount when out of prefix', () => {
      window.history.replaceState(null, '', '/elsewhere');
      const view = render(
        <Route to="/blog/*" as={Layout}>
          <Route as={BlogIndex} />
        </Route>
      );
      expect(view.container.textContent).toBe('');
    });

    it('three-level nesting composes bases correctly', () => {
      window.history.replaceState(null, '', '/admin/users/42');
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
      window.history.replaceState(null, '', '/about');
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
      window.history.replaceState(null, '', '/blog/hello');
      let inner!: Route;
      const Capture = () => (
        <Consumer for={Route}>{(r) => void (inner = r)}</Consumer>
      );
      render(
        <Route to="/blog/*" as={Layout}>
          <Route to=":slug" as={Capture} />
        </Route>
      );
      expect(inner.match).toEqual({ slug: 'hello' });
    });
  });

  describe('redirect prop', () => {
    it('redirects (replacing) when matched', () => {
      window.history.replaceState(null, '', '/');
      const before = window.history.length;
      render(
        <>
          <Route to="" redirect="/home" />
          <Route to="/home" as={Home} />
        </>
      );
      expect(window.location.pathname).toBe('/home');
      expect(window.history.length).toBe(before);
    });

    it('does not redirect when unmatched', () => {
      window.history.replaceState(null, '', '/elsewhere');
      render(<Route to="" redirect="/home" />);
      expect(window.location.pathname).toBe('/elsewhere');
    });

    it('resolves a relative target against the Route anchor', () => {
      window.history.replaceState(null, '', '/posts/foo');
      render(
        <>
          <Route to="/posts/:id" redirect="./edit" />
          <Route to="/posts/:id/edit" as={() => null} />
        </>
      );
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

    window.history.replaceState(null, '', '/profile');
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

    window.history.replaceState(null, '', '/elsewhere');
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

    window.history.replaceState(null, '', '/admin/profile/settings');
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

    window.history.replaceState(null, '', '/profile');
    render(<Route><Profile /></Route>);
    expect(found).toBeInstanceOf(Profile);
  });

  describe('structural children', () => {
    it('mounts child Routes even when the parent is unmatched', () => {
      window.history.replaceState(null, '', '/elsewhere');
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
      window.history.replaceState(null, '', '/elsewhere');
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
      window.history.replaceState(null, '', '/foo/bar');
      const view = render(
        <Route to="foo/*">
          <Route to="bar" as={() => <span>bar</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('bar');
    });

    it('treats non-Route content as a leaf (gated, not always-mounted)', () => {
      window.history.replaceState(null, '', '/elsewhere');
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

describe('active', () => {
  it('is undefined when no child matches', async () => {
    Router.new();
    let root!: Route;
    render(
      <Route is={(r) => (root = r)}>
        <Route to="a" />
        <Route to="b" />
      </Route>
    );
    await act(async () => {});
    expect(root.active).toBeUndefined();
  });

  it('returns the single matched child', async () => {
    const router = Router.new();
    router.goto('/a');
    let root!: Route;
    render(
      <Route is={(r) => (root = r)}>
        <Route to="a" />
        <Route to="b" />
      </Route>
    );
    await act(async () => {});
    expect(root.active?.to).toBe('a');
  });

  it('updates on navigation', async () => {
    const router = Router.new();
    router.goto('/a');
    let root!: Route;
    render(
      <Route is={(r) => (root = r)}>
        <Route to="a" />
        <Route to="b" />
      </Route>
    );
    await act(async () => {});
    expect(root.active?.to).toBe('a');

    await act(async () => router.goto('/b'));
    expect(root.active?.to).toBe('b');
  });

  it('is null when more than one child matches', async () => {
    const router = Router.new();
    router.goto('/a');
    let root!: Route;
    render(
      <Route is={(r) => (root = r)}>
        <Route to="a" />
        <Route to="a" />
      </Route>
    );
    await act(async () => {});
    expect(root.active).toBeNull();
  });

  it('ignores redirect routes as candidates', async () => {
    const router = Router.new();
    router.goto('/a');
    let root!: Route;
    let content!: Route;
    render(
      <Route is={(r) => (root = r)}>
        <Route to="a" redirect="/a" />
        <Route to="a" is={(r) => (content = r)} />
      </Route>
    );
    await act(async () => {});
    expect(root.active).toBe(content);
  });
});