import { Consumer, Context } from '@expressive/react';

import { act, beforeEach, describe, expect, it, render } from '../vitest';

import { Route } from './route';
import { Router } from './router';

beforeEach(() => {
  Context.root.get(Router, false)?.set(null);
  window.history.replaceState(null, '', '/');
});

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

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

  it('ignores non-Route siblings when resolving', () => {
    // Top-level non-Route content renders alongside Route branches.
    window.history.replaceState(null, '', '/');
    const view = render(
      <>
        <div>chrome</div>
        <Route to="/" as={Home} />
      </>
    );
    expect(view.container.textContent).toContain('Home');
  });

  it('renders non-Route children inside a layout', async () => {
    window.history.replaceState(null, '', '/');
    const view = render(
      <Route to="/*">
        <div>chrome</div>
        {'text node'}
        <Route to="" as={Home} />
      </Route>
    );
    await settle();
    expect(view.container.textContent).toBe('chrometext nodeHome');
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

  it('specific sibling beats bare-default Route on specificity', async () => {
    window.history.replaceState(null, '', '/about');
    const view = render(
      <Route>
        <Route to="/about" as={() => <span>About</span>} />
        <Route as={() => <span>Fallback</span>} />
      </Route>
    );
    await settle();
    expect(view.container.textContent).toBe('About');
  });

  it('bare-default Route renders when no sibling matches', async () => {
    window.history.replaceState(null, '', '/nope');
    const view = render(
      <Route>
        <Route to="/about" as={() => <span>About</span>} />
        <Route as={() => <span>Fallback</span>} />
      </Route>
    );
    await settle();
    expect(view.container.textContent).toBe('Fallback');
  });

  it('params returns stable identity when match recomputes to equal content', () => {
    const getter = Object.getOwnPropertyDescriptor(
      Route.prototype,
      'match'
    )!.get!;
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

  it('resolves Routes rendered through an intermediate component', async () => {
    window.history.replaceState(null, '', '/about');
    const Pages = () => (
      <>
        <Route to="/about" as={() => <span>About</span>} />
        <Route to="/contact" as={() => <span>Contact</span>} />
      </>
    );
    // Wrap in a Route so the intermediate component participates in sibling
    // resolution. Without the wrapper, Routes mount independently and both
    // render in their respective locations (only the matching one renders).
    const view = render(
      <Route>
        <Pages />
      </Route>
    );
    await settle();
    expect(view.container.textContent).toBe('About');
  });

  it('Route container re-resolves winner on navigation', async () => {
    window.history.replaceState(null, '', '/a');
    const router = Router.new();
    const view = render(
      <Route>
        <Route to="/a" as={() => <span>A</span>} />
        <Route to="/b" as={() => <span>B</span>} />
      </Route>
    );
    await settle();
    expect(view.container.textContent).toBe('A');
    await act(async () => router.goto('/b'));
    await settle();
    expect(view.container.textContent).toBe('B');
  });

  // Blocked on https://github.com/gabeklein/expressive-state/issues/85 -
  // Expressive does not reset omitted props to defaults on prop update, so
  // a winner-swap to a bare Route inherits the prior `to`.
  it.skip('Route container switches between specific and bare-default on navigation', async () => {
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

  it('parallel Route groups under one parent resolve independently', async () => {
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
    await settle();
    expect(view.container.textContent).toBe('User Header + Users Page');
  });

  it('will not let passthrough Route groups block sibling selection', async () => {
    window.history.replaceState(null, '', '/about');
    const view = render(
      <Route>
        <Route>
          <Route to="/about" as={() => <span>Grouped</span>} />
        </Route>
        <Route to="/about" as={() => <span>Sibling</span>} />
      </Route>
    );
    await settle();
    expect(view.container.textContent).toBe('GroupedSibling');
  });

  it('resolves Routes through a Fragment', async () => {
    window.history.replaceState(null, '', '/about');
    const view = render(
      <Route>
        <>
          <Route to="/about" as={() => <span>About</span>} />
          <Route to="/contact" as={() => <span>Contact</span>} />
        </>
      </Route>
    );
    await settle();
    expect(view.container.textContent).toBe('About');
  });

  describe('specificity', () => {
    it('literal beats :param at the same path', async () => {
      window.history.replaceState(null, '', '/posts/new');
      const view = render(
        <Route>
          <Route to="/posts/:id" as={() => <span>dynamic</span>} />
          <Route to="/posts/new" as={() => <span>literal</span>} />
        </Route>
      );
      await settle();
      expect(view.container.textContent).toBe('literal');
    });

    it(':param beats *', async () => {
      window.history.replaceState(null, '', '/posts/foo');
      const view = render(
        <Route>
          <Route to="*" as={() => <span>catch-all</span>} />
          <Route to="/posts/:id" as={() => <span>dynamic</span>} />
        </Route>
      );
      await settle();
      expect(view.container.textContent).toBe('dynamic');
    });

    it('catch-all matches when no sibling does', async () => {
      window.history.replaceState(null, '', '/anything/at/all');
      const view = render(
        <Route>
          <Route to="/" as={() => <span>home</span>} />
          <Route to="*" as={() => <span>not-found</span>} />
        </Route>
      );
      await settle();
      expect(view.container.textContent).toBe('not-found');
    });

    it('first declared wins on a true tie', async () => {
      window.history.replaceState(null, '', '/posts/foo');
      const view = render(
        <Route>
          <Route to="/posts/:a" as={() => <span>a</span>} />
          <Route to="/posts/:b" as={() => <span>b</span>} />
        </Route>
      );
      await settle();
      expect(view.container.textContent).toBe('a');
    });
  });

  describe('nested routes', () => {
    const Layout = (props: { children?: React.ReactNode }) => (
      <section>
        <nav>chrome</nav>
        {props.children}
      </section>
    );
    const BlogIndex = () => <p>blog-index</p>;
    const BlogPost = () => (
      <Consumer for={Route}>{(r) => <p>post {r.match!.slug}</p>}</Consumer>
    );

    it('layout mounts its prefix-matched child', async () => {
      window.history.replaceState(null, '', '/blog');
      const view = render(
        <Route to="/blog/*" as={Layout}>
          <Route as={BlogIndex} />
          <Route to=":slug" as={BlogPost} />
        </Route>
      );
      await settle();
      expect(view.container.textContent).toBe('chromeblog-index');
    });

    it('layout resolves :param child', async () => {
      window.history.replaceState(null, '', '/blog/hello');
      const view = render(
        <Route to="/blog/*" as={Layout}>
          <Route as={BlogIndex} />
          <Route to=":slug" as={BlogPost} />
        </Route>
      );
      await settle();
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

    it('three-level nesting composes bases correctly', async () => {
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
      await settle();
      expect(view.container.textContent).toBe('admin/users/42');
    });

    it('catch-all layout (to="*") nests children at root base', async () => {
      window.history.replaceState(null, '', '/about');
      const Chrome = (props: { children?: React.ReactNode }) => (
        <main>{props.children}</main>
      );
      const view = render(
        <Route to="*" as={Chrome}>
          <Route to="/about" as={() => <span>about</span>} />
        </Route>
      );
      await settle();
      expect(view.container.textContent).toBe('about');
    });

    it('own captures only - parent params not in child', async () => {
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
      await settle();
      expect(inner.match).toEqual({ slug: 'hello' });
    });
  });
});
