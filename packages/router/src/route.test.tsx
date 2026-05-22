import { Consumer } from '@expressive/react';

import { act, beforeEach, describe, expect, it, render } from '../vitest';

import { Route } from './route';
import { Router } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

const Home = () => <h1>Home</h1>;
const Post = () => {
  return (
    <Consumer for={Route}>
      {(r) => <article>id: {r.params.id}</article>}
    </Consumer>
  );
};

describe('Route', () => {
  it('mounts the page when its pattern matches', () => {
    window.history.replaceState(null, '', '/');
    const view = render(
      <Router>
        <Route to="/" as={Home} />
        <Route to="/posts/:id" as={Post} />
      </Router>
    );
    expect(view.container.textContent).toBe('Home');
  });

  it('does not mount any page when nothing matches', () => {
    window.history.replaceState(null, '', '/unknown');
    const view = render(
      <Router>
        <Route to="/" as={Home} />
      </Router>
    );
    expect(view.container.textContent).toBe('');
  });

  it('exposes params from the matched pattern', () => {
    window.history.replaceState(null, '', '/posts/foo');
    const view = render(
      <Router>
        <Route to="/posts/:id" as={Post} />
      </Router>
    );
    expect(view.container.textContent).toBe('id: foo');
  });

  it('updates in place on same-pattern navigation (instance persists)', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let mountCount = 0;
    let router!: Router;

    const Page = () => {
      mountCount++;
      return (
        <Consumer for={Route}>{(r) => <span>{r.params.id}</span>}</Consumer>
      );
    };

    const view = render(
      <Router is={(r) => (router = r)}>
        <Route to="/posts/:id" as={Page} />
      </Router>
    );

    expect(mountCount).toBe(1);
    expect(view.container.textContent).toBe('foo');

    await act(async () => router.goto('/posts/bar'));

    expect(mountCount).toBe(1);
    expect(view.container.textContent).toBe('bar');
  });

  it('ignores non-Route children when resolving', () => {
    window.history.replaceState(null, '', '/');
    const view = render(
      <Router>
        <div>chrome</div>
        {'text node'}
        <Route to="/" as={Home} />
      </Router>
    );
    // Only the matched Route's page renders; non-Route children are dropped.
    expect(view.container.textContent).toBe('Home');
  });

  it('defaults `as` to a children-passthrough', () => {
    window.history.replaceState(null, '', '/anything');
    const view = render(
      <Router>
        <Route to="/anything">
          <span>inline</span>
        </Route>
      </Router>
    );
    expect(view.container.textContent).toBe('inline');
  });

  it('matches when `to` is omitted (defaults to catch-all)', () => {
    window.history.replaceState(null, '', '/');
    const view = render(
      <Router>
        <Route as={Home} />
      </Router>
    );
    expect(view.container.textContent).toBe('Home');
  });

  it('bare Route matches non-root paths (catch-all default)', () => {
    window.history.replaceState(null, '', '/anything/at/all');
    const view = render(
      <Router>
        <Route as={Home} />
      </Router>
    );
    expect(view.container.textContent).toBe('Home');
  });

  it('specific sibling beats bare-default Route on specificity', () => {
    window.history.replaceState(null, '', '/about');
    const view = render(
      <Router>
        <Route to="/about" as={() => <span>About</span>} />
        <Route as={() => <span>Fallback</span>} />
      </Router>
    );
    expect(view.container.textContent).toBe('About');
  });

  it('bare-default Route renders when no sibling matches', () => {
    window.history.replaceState(null, '', '/nope');
    const view = render(
      <Router>
        <Route to="/about" as={() => <span>About</span>} />
        <Route as={() => <span>Fallback</span>} />
      </Router>
    );
    expect(view.container.textContent).toBe('Fallback');
  });

  it('params returns empty when match invalidated by navigation', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let leaf!: Route;
    let router!: Router;
    const Page = () => (
      <Consumer for={Route}>{(r) => void (leaf = r)}</Consumer>
    );
    render(
      <Router is={(r) => (router = r)}>
        <Route to="/posts/:id" as={Page} />
      </Router>
    );
    expect(leaf.params).toEqual({ id: 'foo' });

    // Navigate to a path the Route does not match. The Route instance
    // briefly evaluates with a null match before unmounting.
    await act(async () => router.goto('/elsewhere'));
    expect(leaf.params).toEqual({});
  });

  it('anchor handles patterns that already end with /', async () => {
    window.history.replaceState(null, '', '/');
    let leaf!: Route;
    const Page = () => (
      <Consumer for={Route}>{(r) => void (leaf = r)}</Consumer>
    );
    render(
      <Router>
        <Route to="/" as={Page} />
      </Router>
    );
    expect(leaf.anchor).toBe('/');
  });

  it('Route.goto resolves relative paths via anchor', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let leaf!: Route;
    const Page = () => (
      <Consumer for={Route}>{(r) => void (leaf = r)}</Consumer>
    );
    render(
      <Router>
        <Route to="/posts/:id" as={Page} />
      </Router>
    );
    await act(async () => leaf.goto('./edit'));
    expect(window.location.pathname).toBe('/posts/foo/edit');
  });

  it('Route.goto treats empty string and "." as no-op', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let leaf!: Route;
    const Page = () => (
      <Consumer for={Route}>{(r) => void (leaf = r)}</Consumer>
    );
    render(
      <Router>
        <Route to="/posts/:id" as={Page} />
      </Router>
    );
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
      <Router>
        <Route to="/posts/:id" as={Page} />
        <Route to="/about" as={() => <div>about</div>} />
      </Router>
    );
    await act(async () => leaf.goto('/about'));
    expect(window.location.pathname).toBe('/about');
  });

  it('Router.goto throws on relative paths', () => {
    let router!: Router;
    render(<Router is={(r) => (router = r)} />);
    expect(() => router.goto('./x')).toThrow(/absolute path/);
  });

  it('default `as` renders nothing when given no children', () => {
    window.history.replaceState(null, '', '/blank');
    const view = render(
      <Router>
        <Route to="/blank" />
      </Router>
    );
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
    const view = render(
      <Router>
        <Pages />
      </Router>
    );
    expect(view.container.textContent).toBe('About');
  });

  it('lexical container re-resolves winner on navigation', async () => {
    window.history.replaceState(null, '', '/a');
    let router!: Router;
    const view = render(
      <Router is={(r) => (router = r)}>
        <Route to="/a" as={() => <span>A</span>} />
        <Route to="/b" as={() => <span>B</span>} />
      </Router>
    );
    expect(view.container.textContent).toBe('A');
    await act(async () => router.goto('/b'));
    expect(view.container.textContent).toBe('B');
  });

  // Blocked on https://github.com/gabeklein/expressive-state/issues/85 -
  // Expressive does not reset omitted props to defaults on prop update, so
  // a winner-swap to a bare Route inherits the prior `to`.
  it.skip('lexical container switches between specific and bare-default on navigation', async () => {
    window.history.replaceState(null, '', '/a');
    let router!: Router;
    const view = render(
      <Router is={(r) => (router = r)}>
        <Route to="/a" as={() => <span>A</span>} />
        <Route as={() => <span>Other</span>} />
      </Router>
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
    const view = render(
      <Router>
        <Route to="admin/*" as={Admin} />
      </Router>
    );
    expect(view.container.textContent).toBe('User Header + Users Page');
  });

it('resolves Routes through a Fragment in lexical children', () => {
    window.history.replaceState(null, '', '/about');
    const view = render(
      <Router>
        <>
          <Route to="/about" as={() => <span>About</span>} />
          <Route to="/contact" as={() => <span>Contact</span>} />
        </>
      </Router>
    );
    expect(view.container.textContent).toBe('About');
  });

  describe('specificity', () => {
    it('literal beats :param at the same path', () => {
      window.history.replaceState(null, '', '/posts/new');
      const view = render(
        <Router>
          <Route to="/posts/:id" as={() => <span>dynamic</span>} />
          <Route to="/posts/new" as={() => <span>literal</span>} />
        </Router>
      );
      expect(view.container.textContent).toBe('literal');
    });

    it(':param beats *', () => {
      window.history.replaceState(null, '', '/posts/foo');
      const view = render(
        <Router>
          <Route to="*" as={() => <span>catch-all</span>} />
          <Route to="/posts/:id" as={() => <span>dynamic</span>} />
        </Router>
      );
      expect(view.container.textContent).toBe('dynamic');
    });

    it('catch-all matches when no sibling does', () => {
      window.history.replaceState(null, '', '/anything/at/all');
      const view = render(
        <Router>
          <Route to="/" as={() => <span>home</span>} />
          <Route to="*" as={() => <span>not-found</span>} />
        </Router>
      );
      expect(view.container.textContent).toBe('not-found');
    });

    it('first declared wins on a true tie', () => {
      window.history.replaceState(null, '', '/posts/foo');
      const view = render(
        <Router>
          <Route to="/posts/:a" as={() => <span>a</span>} />
          <Route to="/posts/:b" as={() => <span>b</span>} />
        </Router>
      );
      expect(view.container.textContent).toBe('a');
    });
  });

  describe('nested routes', () => {
    const Layout = (props: { children?: React.ReactNode }) => (
      <section><nav>chrome</nav>{props.children}</section>
    );
    const BlogIndex = () => <p>blog-index</p>;
    const BlogPost = () => (
      <Consumer for={Route}>{(r) => <p>post {r.params.slug}</p>}</Consumer>
    );

    it('layout mounts its prefix-matched child', () => {
      window.history.replaceState(null, '', '/blog');
      const view = render(
        <Router>
          <Route to="/blog/*" as={Layout}>
            <Route as={BlogIndex} />
            <Route to=":slug" as={BlogPost} />
          </Route>
        </Router>
      );
      expect(view.container.textContent).toBe('chromeblog-index');
    });

    it('layout resolves :param child', () => {
      window.history.replaceState(null, '', '/blog/hello');
      const view = render(
        <Router>
          <Route to="/blog/*" as={Layout}>
            <Route as={BlogIndex} />
            <Route to=":slug" as={BlogPost} />
          </Route>
        </Router>
      );
      expect(view.container.textContent).toBe('chromepost hello');
    });

    it('layout does not mount when out of prefix', () => {
      window.history.replaceState(null, '', '/elsewhere');
      const view = render(
        <Router>
          <Route to="/blog/*" as={Layout}>
            <Route as={BlogIndex} />
          </Route>
        </Router>
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
        <Consumer for={Route}>{(r) => <span>{r.params.id}</span>}</Consumer>
      );
      const view = render(
        <Router>
          <Route to="/admin/*" as={AdminChrome}>
            <Route to="users/*" as={UsersChrome}>
              <Route to=":id" as={UserDetail} />
            </Route>
          </Route>
        </Router>
      );
      expect(view.container.textContent).toBe('admin/users/42');
    });

    it('catch-all layout (to="*") nests children at root base', () => {
      window.history.replaceState(null, '', '/about');
      const Chrome = (props: { children?: React.ReactNode }) => (
        <main>{props.children}</main>
      );
      const view = render(
        <Router>
          <Route to="*" as={Chrome}>
            <Route to="/about" as={() => <span>about</span>} />
          </Route>
        </Router>
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
        <Router>
          <Route to="/blog/*" as={Layout}>
            <Route to=":slug" as={Capture} />
          </Route>
        </Router>
      );
      // The innermost Route's params are only its own pattern's captures.
      // Parent's catch-all capture (`*`) is not folded in.
      expect(inner.params).toEqual({ slug: 'hello' });
    });
  });
});
