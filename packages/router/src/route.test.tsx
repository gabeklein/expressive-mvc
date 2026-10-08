import { act, render, screen } from '@testing-library/react';
import { lazy, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Component } from '@expressive/react';

import { location, browserRouter, mockError, mockPromise, renderAct } from '../test.setup';
import { Route } from './route';
import { Router } from './router';

const router = browserRouter();

const Home = () => <h1>Home</h1>;
const Post = () => <article>id: {Route.get().match!.id}</article>;
const text = (label: string) => () => <span>{label}</span>;

const Layout = (props: { children?: ReactNode }) => <main>{props.children}</main>;
const Chrome = (props: { children?: ReactNode }) => <main>chrome/{props.children}</main>;

/** Render an anonymous root Route over `children`, capturing it, then settle. */
async function mount(children: ReactNode) {
  let root!: Route;
  const view = await renderAct(<Route is={(r) => (root = r)}>{children}</Route>);
  return { root, view };
}

/** Render `ui` at `path` and return its exact text. */
async function at(path: string, ui: ReactNode) {
  location(path);
  return (await renderAct(ui)).container.textContent;
}

type Capture = (route: Route) => void;

/** Render a leaf Route at `path` - a bare pattern, or a tree placing `is` - and return it. */
function leafAt(path: string, ui: string | ((is: Capture) => ReactNode)) {
  let leaf!: Route;
  const is: Capture = (r) => void (leaf = r);
  location(path);
  render(typeof ui === 'string' ? <Route to={ui} is={is} /> : ui(is));
  return leaf;
}

const visit = (path: string) => act(async () => router.current.goto(path));

const settled = <T,>(module: ReturnType<typeof mockPromise<T>>, value: T) =>
  act(async () => {
    module.resolve(value);
    await module;
  });

describe('Route', () => {
  it.each([
    ['will mount the page when its pattern matches', '/', <><Route to="/" as={Home} /><Route to="/posts/:id" as={Post} /></>, 'Home'],
    ['will mount nothing when nothing matches', '/unknown', <Route to="/" as={Home} />, ''],
    ['will expose params from the matched pattern', '/posts/foo', <Route to="/posts/:id" as={Post} />, 'id: foo'],
    ['will render alongside non-Route siblings', '/', <><div>chrome</div><Route to="/" as={Home} /></>, 'chromeHome'],
    ['will keep non-Route children inside a passthrough Route', '/', <Route to="/*"><div>chrome</div>{' text node '}<Route to="" as={Home} /></Route>, 'chrome text node Home'],
    ['will default `as` to a children passthrough', '/anything', <Route to="/anything"><span>inline</span></Route>, 'inline'],
    ['will render nothing by default `as` without children', '/blank', <Route to="/blank" />, ''],
    ['will treat a bare Route as an always-on root', '/anything/deep', <Route as={Home} />, 'Home'],
    ['will treat root to="" as an index on root', '/', <Route to="" as={Home} />, 'Home'],
    ['will not match root to="" off root', '/anything', <Route to="" as={Home} />, ''],
    ['will prefer a specific sibling declared before a bare Route', '/about', <Route><Route to="/about" as={text('About')} /><Route as={text('Fallback')} /></Route>, 'About'],
    ['will render a none Route when no earlier sibling matches', '/nope', <Route><Route to="/about" as={text('About')} /><Route none as={text('Fallback')} /></Route>, 'Fallback'],
    ['will resolve Routes in a Fragment', '/about', <Route><><Route to="/about" as={text('About')} /><Route to="/contact" as={text('Contact')} /></></Route>, 'About']
  ])('%s', async (_, path, ui, expected) => {
    expect(await at(path, ui)).toBe(expected);
  });

  it('will resolve Routes rendered through an intermediate component', async () => {
    const Pages = () => (
      <>
        <Route to="/about" as={text('About')} />
        <Route to="/contact" as={text('Contact')} />
      </>
    );
    expect(await at('/about', <Route><Pages /></Route>)).toBe('About');
  });

  it('will resolve parallel Route groups under one parent independently', async () => {
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
    expect(await at('/admin/users', <Route to="admin/*" as={Admin} />)).toBe('User Header + Users Page');
  });

  it('will own a fallback router when none is in context', () => {
    router.current.set(null);

    const route = Route.new();
    const fallback = route.router;

    expect(fallback).toBeInstanceOf(Router);
    expect(fallback).not.toBe(router.current);
    expect(fallback.get(null)).toBe(false);

    route.set(null);
    expect(fallback.get(null)).toBe(true);
  });

  it('will expose the router query', () => {
    const route = Route.new();
    expect(route.query).toBe(route.router.query);
  });

  it('will clear match when navigation invalidates it', async () => {
    const leaf = leafAt('/posts/foo', '/posts/:id');
    expect(leaf.match).toEqual({ id: 'foo' });

    await visit('/elsewhere');
    expect(leaf.match).toBeUndefined();
  });

  it('will anchor a pattern already ending in /', () => {
    expect(leafAt('/', '/').anchor).toBe('/');
  });

  describe('Route.goto', () => {
    it.each([
      ['will resolve relative paths via anchor', '/posts/foo', '/posts/:id', './edit', '/posts/foo/edit'],
      ['will preserve query in relative paths', '/posts/foo', '/posts/:id', './edit?tab=history', '/posts/foo/edit?tab=history'],
      ['will resolve a fragment against the Route, keeping query', '/posts/foo?view=full#intro', '/posts/:id', '#details', '/posts/foo?view=full#details'],
      ['will navigate to the Route itself with no argument', '/posts/foo', '/posts/:id', undefined, '/posts/foo'],
      ['will pass absolute paths through to Router', '/posts/foo', '/posts/:id', '/about', '/about'],
      ['will pop to a param ancestor from below', '/posts/foo/edit', (is: Capture) => <Route to="/posts/:id" is={is}><Route to="edit" as={text('edit')} /></Route>, undefined, '/posts/foo'],
      ['will resolve relative paths from a nested Route against its full base', '/posts/foo/edit', (is: Capture) => <Route to="/posts/:id"><Route to="edit" is={is} as={text('edit')} /></Route>, '../tags', '/posts/foo/tags'],
      ['will swap a single param', '/document/123', '/document/:id', { id: '456' }, '/document/456'],
      ['will swap a later param, keeping the rest', '/a/1/2', '/a/:b/:c', { c: '9' }, '/a/1/9'],
      ['will swap an earlier param, keeping the rest', '/a/1/2', '/a/:b/:c', { b: '8' }, '/a/8/2'],
      ['will swap a param on a nested leaf', '/document/123', (is: Capture) => <Route to="/document"><Route to=":id" is={is} as={text('doc')} /></Route>, { id: '456' }, '/document/456'],
      ['will fill purely from overrides when unmatched', '/elsewhere', '/document/:id', { id: '7' }, '/document/7'],
      ['will let a flat leaf own every param in its pattern', '/org/1/user/2', '/org/:orgId/user/:userId', { orgId: '9' }, '/org/9/user/2']
    ])('%s', async (_, path, ui, to, url) => {
      const leaf = leafAt(path, ui);
      await act(async () => leaf.goto(to as any));
      expect(router.current.url).toBe(url);
      expect(window.location.pathname + window.location.search + window.location.hash).toBe(url);
    });

    it.each([
      ['will throw resolving from an unmatched Route', '/elsewhere', '/posts/:id', undefined, /unresolved parameters/],
      ['will throw when a swap leaves a param unresolved', '/elsewhere', '/document/:id', {}, /unresolved parameters/],
      ['will throw swapping on a Route with no params', '/about', '/about', { id: '1' }, /owns only \[none\]/],
      ['will throw on a param the Route does not declare', '/document/123', '/document/:id', { nope: 'x' }, /cannot set param "nope"/],
      ['will throw swapping a param inherited by a nested leaf', '/org/1/user/2', (is: Capture) => <Route to="org/:orgId"><Route to="user/:userId" is={is} as={() => null} /></Route>, { orgId: '9' }, /cannot set param "orgId"/]
    ])('%s', (_, path, ui, to, error) => {
      const leaf = leafAt(path, ui);
      expect(() => leaf.goto(to as any)).toThrow(error);
    });

    it('will replace history on a param swap with replace', async () => {
      const leaf = leafAt('/document/123', '/document/:id');
      const before = window.history.length;
      await act(async () => leaf.goto({ id: '456' }, true));
      expect(window.location.pathname).toBe('/document/456');
      expect(window.history.length).toBe(before);
    });
  });

  // Blocked on https://github.com/gabeklein/expressive-state/issues/85 -
  // Expressive does not reset omitted props to defaults on prop update, so
  // a winner-swap to a bare Route inherits the prior `to`.
  it.skip('switches between specific and bare-none on navigation', async () => {
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

  describe('declaration order', () => {
    const dynamic = <Route to="/posts/:id" as={text('dynamic')} />;
    const literal = <Route to="/posts/new" as={text('literal')} />;

    it.each([
      ['will let a first-declared :param shadow a later literal', '/posts/new', <Route>{dynamic}{literal}</Route>, 'dynamic'],
      ['will let a first-declared literal win', '/posts/new', <Route>{literal}{dynamic}</Route>, 'literal'],
      ['will let a first-declared :param shadow a later catch-all', '/posts/foo', <Route>{dynamic}<Route to="*" as={text('catch-all')} /></Route>, 'dynamic'],
      ['will let a last catch-all catch what earlier siblings miss', '/anything/at/all', <Route><Route to="/" as={text('home')} /><Route to="*" as={text('not-found')} /></Route>, 'not-found'],
      ['will let the first of equal matches win', '/posts/foo', <Route><Route to="/posts/:a" as={text('a')} /><Route to="/posts/:b" as={text('b')} /></Route>, 'a']
    ])('%s', async (_, path, ui, expected) => {
      expect(await at(path, ui)).toBe(expected);
    });

    it('will re-resolve the winner on navigation', async () => {
      location('/posts/new');
      const view = render(<Route>{literal}{dynamic}</Route>);
      expect(view.container.textContent).toBe('literal');

      await visit('/posts/bar');
      expect(view.container.textContent).toBe('dynamic');

      await visit('/posts/new');
      expect(view.container.textContent).toBe('literal');
    });
  });

  describe('nested routes', () => {
    const blog = (
      <Route to="/blog/*" as={Chrome}>
        <Route to=":slug" as={() => <p>post {Route.get().match!.slug}</p>} />
        <Route as={text('blog-index')} />
      </Route>
    );

    it.each([
      ['will mount the index child of a layout', '/blog', blog, 'chrome/blog-index'],
      ['will resolve a :param child of a layout', '/blog/hello', blog, 'chrome/post hello'],
      ['will not mount a layout out of prefix', '/elsewhere', blog, ''],
      ['will not let a passthrough group block sibling selection', '/about', <Route><Route><Route to="/about" as={text('Grouped')} /></Route><Route to="/about" as={text('Sibling')} /></Route>, 'GroupedSibling'],
      ['will resolve nested Routes inside a layout via context', '/blog/hello', <Route to="/blog/*" as={Chrome}><Route to=":id" as={Post} /></Route>, 'chrome/id: hello'],
      ['will compose bases across three levels', '/admin/users/42', <Route to="/admin/*" as={(p: { children?: ReactNode }) => <main>admin/{p.children}</main>}><Route to="users/*" as={(p: { children?: ReactNode }) => <>users/{p.children}</>}><Route to=":id" as={Post} /></Route></Route>, 'admin/users/id: 42'],
      ['will nest children of a catch-all layout at root base', '/about', <Route to="*" as={Layout}><Route to="/about" as={text('about')} /></Route>, 'about']
    ])('%s', async (_, path, ui, expected) => {
      expect(await at(path, ui)).toBe(expected);
    });

    it('will unregister a child destroyed after its scope', async () => {
      location('/a/b');
      let scope!: Route;
      let leaf!: Route;
      const view = await renderAct(
        <Route>
          <Route to="a/*" is={(r) => (scope = r)}>
            <Route to="b" is={(r) => (leaf = r)} as={text('b')} />
          </Route>
        </Route>
      );
      expect(view.container.textContent).toBe('b');
      expect(scope.inner).toEqual([leaf]);

      await act(async () => scope.set(null));
      await act(async () => leaf.set(null));
      expect(leaf.get(null)).toBe(true);
      expect(scope.inner).toEqual([leaf]);
    });

    it('will capture only own params, not the parent\'s', () => {
      const leaf = leafAt('/blog/hello', (is) => (
        <Route to="/blog/*" as={Layout}>
          <Route to=":slug" is={is} />
        </Route>
      ));
      expect(leaf.match).toEqual({ slug: 'hello' });
    });
  });

  // A multi-segment `to` ("users/:id") is a flat leaf - it does NOT synthesize an
  // intermediate "users" scope. Only explicit nesting opens a scope that can hold
  // a section `none` / shared chrome. These pin that the two forms differ.
  describe('scope vs segment (no desugaring)', () => {
    const Detail = text('detail');
    const New = text('new');

    const nested = (
      <Route to="users" as={Chrome}>
        <Route to="new" as={New} />
        <Route to=":id" as={Detail} />
        <Route none as={text('section-404')} />
      </Route>
    );

    const flat = (
      <Route>
        <Route to="users/new" as={New} />
        <Route to="users/:id" as={Detail} />
        <Route none as={text('app-404')} />
      </Route>
    );

    it.each([
      ['will catch a nested-form miss with the section none Route, in chrome', '/users', nested, 'chrome/section-404'],
      ['will drop a flat-form miss to the app none Route, without chrome', '/users', flat, 'app-404'],
      ['will match the nested form like the flat form', '/users/42', nested, 'chrome/detail'],
      ['will match the flat form like the nested form', '/users/42', flat, 'detail'],
      ['will let a literal beat the param in the nested form', '/users/new', nested, 'chrome/new'],
      ['will let a literal beat the param in the flat form', '/users/new', flat, 'new'],
      ['will treat mixed children as a content route, not a scope', '/posts', <Route to="posts/*" as={Chrome}>hello<Route to="recent" as={Detail} /></Route>, 'chrome/hello']
    ])('%s', async (_, path, ui, expected) => {
      expect(await at(path, ui)).toBe(expected);
    });

    it('will interpose a section Route only in the nested form', () => {
      const nestedLeaf = leafAt('/users/42', (is) => (
        <Route to="users" as={Chrome}>
          <Route to=":id" is={is} as={Detail} />
        </Route>
      ));
      expect(nestedLeaf.parent!.path).toBe('/users');

      const flatLeaf = leafAt('/users/42', (is) => (
        <Route>
          <Route to="users/:id" is={is} as={Detail} />
        </Route>
      ));
      expect(flatLeaf.parent!.path).toBe('');
    });

    it('will keep nested chrome across a param swap', async () => {
      location('/users/1');
      let leaf!: Route;
      const view = render(
        <Route to="users" as={Chrome}>
          <Route to=":id" is={(r) => (leaf = r)} as={() => <span>{Route.get().match!.id}</span>} />
        </Route>
      );
      expect(view.container.textContent).toBe('chrome/1');

      await act(async () => leaf.goto({ id: '2' }));
      expect(view.container.textContent).toBe('chrome/2');
    });
  });

  // A section scope owning a `none` Route is claimed by it for any path
  // within it - the same verdict whether the scope is the root route or sits
  // under a wrapper alongside other `as`-bearing siblings.
  describe('section none Route under a wrapper', () => {
    const Detail = text('detail');
    const SectionMissing = text('section-404');
    const Index = text('index');

    const docs = (
      <Route to="docs" as={Chrome}>
        <Route to=":id" as={Detail} />
        <Route none as={SectionMissing} />
      </Route>
    );

    const wrapped = <Route>{docs}</Route>;
    const indexed = <Route><Route as={Index} />{docs}</Route>;

    it.each([
      ['will catch a miss when the section is the root route', '/docs', docs, 'chrome/section-404'],
      ['will catch a deep miss when the section is the root route', '/docs/a/b', docs, 'chrome/section-404'],
      ['will catch a miss under a plain wrapper', '/docs', wrapped, 'chrome/section-404'],
      ['will catch a deep miss under a plain wrapper', '/docs/a/b', wrapped, 'chrome/section-404'],
      ['will catch a miss with an index sibling present', '/docs', indexed, 'chrome/section-404'],
      ['will catch a deep miss with an index sibling present', '/docs/a/b', indexed, 'chrome/section-404'],
      ['will resolve a real child with an index sibling present', '/docs/intro', indexed, 'chrome/detail'],
      ['will not let the section claim the index path', '/', indexed, 'index'],
      ['will keep outer chrome when an inner section catches', '/site/docs', <Route to="site" as={(p: { children?: ReactNode }) => <div>outer/{p.children}</div>}>{docs}</Route>, 'outer/chrome/section-404'],
      ['will not throw for a later sibling above the section', '/docs', <Route><Route to="docs/team" as={Chrome}><Route none as={SectionMissing} /></Route><Route to="docs" as={Index} /></Route>, 'index'],
      ['will yield to an earlier flat sibling under the section path', '/docs/team/roster', <Route><Route to="docs/team/roster" as={text('roster')} />{docs}</Route>, 'roster'],
      ['will not claim a sibling path outside the section', '/about', <Route>{docs}<Route to="about" as={text('about')} /></Route>, 'about']
    ])('%s', async (_, path, ui, expected) => {
      expect(await at(path, ui)).toBe(expected);
    });

    it.each([
      ['will throw if a later sibling is shadowed by a section none Route', '/docs/team/roster', <Route>{docs}<Route to="docs/team/roster" as={text('roster')} /></Route>, /Route "\/docs\/team\/roster" is unreachable/],
      ['will throw if a param section none Route shadows a later sibling', '/', <Route><Route to=":section" as={Chrome}><Route none as={SectionMissing} /></Route><Route to="docs/intro" as={Detail} /></Route>, /unreachable/]
    ])('%s', (_, path, ui, error) => {
      location(path);
      expect(() => render(ui)).toThrow(error);
    });
  });

  describe('redirect prop', () => {
    it('will redirect (replacing) when matched', async () => {
      const before = window.history.length;
      await renderAct(
        <>
          <Route to="" redirect="/home" />
          <Route to="/home" as={Home} />
        </>
      );
      expect(window.location.pathname).toBe('/home');
      expect(window.history.length).toBe(before);
    });

    it('will not redirect when unmatched', () => {
      location('/elsewhere');
      render(<Route to="" redirect="/home" />);
      expect(window.location.pathname).toBe('/elsewhere');
    });

    it('will resolve a relative target against the Route anchor', async () => {
      location('/posts/foo');
      await renderAct(
        <>
          <Route to="/posts/:id" redirect="./edit" />
          <Route to="/posts/:id/edit" as={() => null} />
        </>
      );
      expect(window.location.pathname).toBe('/posts/foo/edit');
    });

    describe('functional guard', () => {
      it('will redirect when a sync guard returns a string', async () => {
        location('/admin');
        await renderAct(
          <>
            <Route to="/admin" redirect={() => '/login'} as={() => <h1>secret</h1>} />
            <Route to="/login" as={() => <h1>login</h1>} />
          </>
        );
        expect(window.location.pathname).toBe('/login');
        expect(screen.getByText('login')).toBeDefined();
      });

      it.each([
        ['will render normally when a sync guard returns undefined', undefined],
        ['will treat an empty-string verdict as allow', '']
      ])('%s', async (_, verdict) => {
        location('/admin');
        await renderAct(<Route to="/admin" redirect={() => verdict} as={() => <h1>secret</h1>} />);
        expect(window.location.pathname).toBe('/admin');
        expect(screen.getByText('secret')).toBeDefined();
      });

      it('will not run the guard while unmatched', async () => {
        location('/elsewhere');
        let ran = 0;
        await renderAct(
          <>
            <Route to="/admin" redirect={() => { ran++; return '/login'; }} as={() => <h1>secret</h1>} />
            <Route to="/elsewhere" as={() => <h1>here</h1>} />
          </>
        );
        expect(ran).toBe(0);
        expect(screen.getByText('here')).toBeDefined();
      });

      it('will run the guard on a route whose own pattern has a param', async () => {
        location('/document/123');
        let ran = 0;
        await renderAct(
          <>
            <Route to="/document/:id" redirect={() => { ran++; return '/login'; }} as={() => <h1>doc</h1>} />
            <Route to="/login" as={() => <h1>login</h1>} />
          </>
        );
        expect(ran).toBe(1);
        expect(window.location.pathname).toBe('/login');
        expect(screen.getByText('login')).toBeDefined();
      });

      it('will guard a whole section, redirecting from a deep child path', async () => {
        location('/admin/users');
        await renderAct(
          <>
            <Route to="/admin/*" redirect={() => '/login'} as={Layout}>
              <Route to="users" as={() => <h1>users</h1>} />
            </Route>
            <Route to="/login" as={() => <h1>login</h1>} />
          </>
        );
        expect(window.location.pathname).toBe('/login');
        expect(screen.getByText('login')).toBeDefined();
      });

      describe('async', () => {
        it('will show fallback while pending, then allow', async () => {
          location('/admin');
          const gate = mockPromise<string | void>();
          await renderAct(
            <Route
              to="/admin"
              fallback={<h1>checking</h1>}
              redirect={() => gate}
              as={() => <h1>secret</h1>}
            />
          );
          expect(screen.getByText('checking')).toBeDefined();

          await act(async () => { gate.resolve(undefined); });
          expect(window.location.pathname).toBe('/admin');
          expect(screen.getByText('secret')).toBeDefined();
        });

        it('will show fallback while pending, then redirect', async () => {
          location('/admin');
          const gate = mockPromise<string | void>();
          await renderAct(
            <>
              <Route
                to="/admin"
                fallback={<h1>checking</h1>}
                redirect={() => gate}
                as={() => <h1>secret</h1>}
              />
              <Route to="/login" as={() => <h1>login</h1>} />
            </>
          );
          expect(screen.getByText('checking')).toBeDefined();

          await act(async () => { gate.resolve('/login'); });
          expect(window.location.pathname).toBe('/login');
          expect(screen.getByText('login')).toBeDefined();
        });
      });

      describe('caching', () => {
        it('will run the guard once per entry, reusing it for in-space navigation', async () => {
          location('/admin/users');
          let ran = 0;
          const guard = () => { ran++; return undefined; };
          await renderAct(
            <Route to="/admin/*" redirect={guard} as={Layout}>
              <Route to="users" as={() => <h1>users</h1>} />
              <Route to="roles" as={() => <h1>roles</h1>} />
            </Route>
          );
          expect(ran).toBe(1);
          expect(screen.getByText('users')).toBeDefined();

          await visit('/admin/roles');
          expect(screen.getByText('roles')).toBeDefined();
          expect(ran).toBe(1);
        });

        it('will re-run the guard when its own param changes', async () => {
          location('/vault/charter');
          const seen: string[] = [];
          const guard = () => {
            const doc = router.current.path.split('/').pop()!;
            seen.push(doc);
            return doc === 'charter' ? undefined : null;
          };
          await renderAct(
            <Route to="vault">
              <Route to=":doc" redirect={guard} as={() => <h1>doc</h1>} />
              <Route none as={() => <h1>missing</h1>} />
            </Route>
          );
          expect(screen.getByText('doc')).toBeDefined();

          await visit('/vault/secrets');
          expect(screen.getByText('missing')).toBeDefined();
          expect(seen).toEqual(['charter', 'secrets']);
        });

        it('will reuse the verdict across descendant params but not its own', async () => {
          location('/org/1/a');
          let ran = 0;
          const guard = () => { ran++; return undefined; };
          await renderAct(
            <Route to="org/:org" redirect={guard} as={Layout}>
              <Route to=":tab" as={() => <h1>tab</h1>} />
            </Route>
          );
          expect(ran).toBe(1);

          await visit('/org/1/b');
          expect(ran).toBe(1);

          await visit('/org/2/b');
          expect(screen.getByText('tab')).toBeDefined();
          expect(ran).toBe(2);
        });

        it('will re-run the guard on re-entry', async () => {
          location('/admin');
          let ran = 0;
          const guard = () => { ran++; return undefined; };
          await renderAct(
            <>
              <Route to="/admin" redirect={guard} as={() => <h1>secret</h1>} />
              <Route to="/elsewhere" as={() => <h1>here</h1>} />
            </>
          );
          expect(ran).toBe(1);

          await visit('/elsewhere');
          expect(screen.getByText('here')).toBeDefined();

          await visit('/admin');
          expect(screen.getByText('secret')).toBeDefined();
          expect(ran).toBe(2);
        });

        it('will re-run the redirect on re-entry under a persistent parent', async () => {
          location('/admin/secret');
          let ran = 0;
          const redirect = () => { ran++; return undefined; };
          await renderAct(
            <Route to="/admin/*" as={Layout}>
              <Route to="secret" redirect={redirect} as={() => <h1>secret</h1>} />
              <Route to="open" as={() => <h1>open</h1>} />
            </Route>
          );
          expect(ran).toBe(1);
          expect(screen.getByText('secret')).toBeDefined();

          await visit('/admin/open');
          expect(screen.getByText('open')).toBeDefined();

          await visit('/admin/secret');
          expect(screen.getByText('secret')).toBeDefined();
          expect(ran).toBe(2);
        });

        it('will re-run an async redirect on re-entry under a persistent parent', async () => {
          location('/admin/secret');
          let ran = 0;
          let gate = mockPromise<string | void>();
          const redirect = () => { ran++; return gate; };
          await renderAct(
            <Route to="/admin/*" as={Layout}>
              <Route to="secret" fallback={<h1>checking</h1>} redirect={redirect} as={() => <h1>secret</h1>} />
              <Route to="open" as={() => <h1>open</h1>} />
            </Route>
          );
          expect(screen.getByText('checking')).toBeDefined();

          await act(async () => gate.resolve(undefined));
          expect(screen.getByText('secret')).toBeDefined();
          expect(ran).toBe(1);

          await visit('/admin/open');
          expect(screen.getByText('open')).toBeDefined();

          gate = mockPromise<string | void>();
          await visit('/admin/secret');
          expect(screen.getByText('open')).toBeDefined();
          expect(ran).toBe(2);

          await act(async () => gate.resolve(undefined));
          expect(screen.getByText('secret')).toBeDefined();
        });
      });

      describe('force-404 (null verdict)', () => {
        const Document = () => <article>doc</article>;
        const NotFound = () => <h1>not found</h1>;

        it.each([
          ['will cede the path to the scope none Route on a null verdict', null, 'not found'],
          ['will render the document on a non-null verdict', undefined, 'doc']
        ])('%s', async (_, verdict, expected) => {
          location('/document/123');
          const gate = mockPromise<string | void | null>();
          const view = await renderAct(
            <Route to="document" as={Layout}>
              <Route to=":id" fallback={<h1>loading</h1>} redirect={() => gate} as={Document} />
              <Route none as={NotFound} />
            </Route>
          );
          expect(view.container.textContent).toBe('loading');

          await act(async () => gate.resolve(verdict));
          expect(view.container.textContent).toBe(expected);
          expect(window.location.pathname).toBe('/document/123');
        });

        it('will cede to the none Route after an earlier redirect', async () => {
          location('/');
          let gate = mockPromise<string | void | null>();
          let router!: Router;
          await renderAct(
            <Route is={(r) => (router = r.router)}>
              <Route as={() => <h1>lobby</h1>} />
              <Route to="login" as={() => <h1>login</h1>} />
              <Route to="document" as={Layout}>
                <Route to=":id" redirect={() => gate} as={Document} />
                <Route none as={NotFound} />
              </Route>
            </Route>
          );

          await act(async () => router.goto('/document/1'));
          await act(async () => gate.resolve('/login'));
          expect(screen.getByText('login')).toBeDefined();

          await act(async () => router.goto('/'));
          gate = mockPromise();
          await act(async () => router.goto('/document/2'));
          await act(async () => gate.resolve(null));
          expect(screen.getByText('not found')).toBeDefined();
        });

        it('will mark the forfeited path on the router, cleared on navigation', async () => {
          location('/document/123');
          const gate = mockPromise<string | void | null>();
          let router!: Router;
          await renderAct(
            <Route to="document" as={Layout} is={(r) => (router = r.router)}>
              <Route to=":id" redirect={() => router.path === '/document/123' ? gate : undefined} as={Document} />
              <Route none as={NotFound} />
            </Route>
          );
          await act(async () => { gate.resolve(null); });
          expect(router.rejected).toBe('/document/123');
          expect(screen.getByText('not found')).toBeDefined();

          await act(async () => router.goto('/document/999'));
          expect(router.rejected === router.path).toBe(false);
          expect(screen.getByText('doc')).toBeDefined();
        });

        it('will clear the rejection when the guard later allows', async () => {
          location('/admin');
          let allow = false;
          let owner!: Router;
          const gate = () => (allow ? undefined : null);
          const tree = () => (
            <Route is={(r) => (owner = r.router)}>
              <Route to="admin" redirect={() => gate()} as={() => <h1>secret</h1>} />
              <Route none as={NotFound} />
            </Route>
          );

          const view = await renderAct(tree());
          expect(owner.rejected).toBe('/admin');
          expect(screen.getByText('not found')).toBeDefined();

          allow = true;
          await act(async () => view.rerender(tree()));
          expect(owner.rejected).toBe('');
          expect(screen.getByText('secret')).toBeDefined();
        });

        it('will not report a force-404\'d leaf as the active child', async () => {
          location('/document/123');
          const gate = mockPromise<string | void | null>();
          let scope!: Route;
          await renderAct(
            <Route to="document" as={Layout} is={(r) => (scope = r)}>
              <Route to=":id" redirect={() => gate} as={Document} />
              <Route none as={NotFound} />
            </Route>
          );
          await act(async () => { gate.resolve(null); });
          expect(scope.active).toBeUndefined();
        });
      });
    });
  });
});

describe('extends', () => {
  it('will gate subclass render() on match', async () => {
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
    expect(ran).toBe(0);

    await visit('/profile');
    expect(view.container.textContent).toBe('profile');
    expect(ran).toBe(1);
  });

  it('will let a subclass own nested routes under its mount path', async () => {
    class Profile extends Route {
      to = 'profile/*';
      render() {
        return (
          <>
            <Route to="" as={text('index')} />
            <Route to="settings" as={text('settings')} />
          </>
        ) as any;
      }
    }

    expect(await at('/admin/profile/settings', <Route><Route to="admin/*"><Profile /></Route></Route>)).toBe('settings');
  });

  it('will be addressable in context by class identity from a descendant', () => {
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

  class Page extends Route {}

  const section = (
    <Route>
      <Route to="section/*" as={(p: { children?: ReactNode }) => <div>chrome:{p.children}</div>}>
        <Page to="info" as={text('info')} />
      </Route>
    </Route>
  );

  it.each([
    ['will show see-through chrome when a subclass descendant matches', '/section/info', section, 'chrome:info'],
    ['will hide see-through chrome when no subclass descendant matches', '/elsewhere', section, ''],
    ['will resolve a see-through scope via a subclass none child', '/section/anything', <Route><Route to="section/*"><Page none as={text('fallback')} /></Route></Route>, 'fallback'],
    ['will arbitrate subclass siblings by declaration order', '/about', <Route><Page to="/about" as={text('About')} /><Page to="/:slug" as={text('Slug')} /></Route>, 'About']
  ])('%s', async (_, path, ui, expected) => {
    expect(await at(path, ui)).toBe(expected);
  });

  describe('children seam', () => {
    class Page extends Route {
      None: () => any = text('fallback');
      protected get children(): Component.Node {
        return (<>{super.children}<Route none as={this.None} /></>) as any;
      }
    }

    it('will tolerate the layer render invoked bare', async () => {
      router.current.goto('/a');
      const { root } = await mount(<Route to="a" as={Home} />);
      expect(Route.prototype.render.call(root)).toBeDefined();
    });

    const info = (
      <Page to="section/*">
        <Route to="info" as={text('info')} />
      </Page>
    );

    it.each([
      ['will convert a subclass None into a child none Route', '/section/missing', <Route>{info}</Route>, 'fallback'],
      ['will let a real sibling match win over the injected none Route', '/section/info', <Route>{info}</Route>, 'info'],
      ['will make a leaf see-through when only a none Route is contributed', '/section/anything', <Route><Page to="section/*" /></Route>, 'fallback'],
      ['will let a contributed none Route suppress an ancestor none Route', '/section/missing', <Route>{info}<Route none as={text('app-404')} /></Route>, 'fallback']
    ])('%s', async (_, path, ui, expected) => {
      expect(await at(path, ui)).toBe(expected);
    });

    it('will not run subclass content when unmatched', () => {
      let ran = 0;
      class Tracked extends Route {
        protected get children(): Component.Node {
          return (
            <>{super.children}<Route none as={() => { ran++; return <span>x</span>; }} /></>
          ) as any;
        }
      }
      location('/elsewhere');
      const view = render(
        <Route>
          <Tracked to="section/*">
            <Route to="info" as={text('info')} />
          </Tracked>
        </Route>
      );
      expect(view.container.textContent).toBe('');
      expect(ran).toBe(0);
    });
  });

  describe('structural children', () => {
    it('will mount child Routes, including in a Fragment, while the parent is unmatched', () => {
      location('/elsewhere');
      let mounted = 0;
      const view = render(
        <Route to="foo/*">
          <Route to="bar" is={() => mounted++} as={text('bar')} />
          <>
            <Route to="a" is={() => mounted++} />
            <Route to="b" is={() => mounted++} />
          </>
        </Route>
      );
      expect(mounted).toBe(3);
      expect(view.container.textContent).toBe('');
    });

    it('will show the matched child once the parent matches', async () => {
      expect(await at('/foo/bar', <Route to="foo/*"><Route to="bar" as={text('bar')} /></Route>)).toBe('bar');
    });

    it('will gate non-Route content as a leaf', () => {
      location('/elsewhere');
      let ran = false;
      const Content = () => { ran = true; return <span>content</span>; };
      const view = render(
        <Route to="foo/*">
          <Content />
        </Route>
      );
      expect(ran).toBe(false);
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

const aa = (
  <>
    <Route to="a" />
    <Route to="a" />
  </>
);

describe('active and matches', () => {
  it.each([
    ['will report nothing when no child matches', '/', ab, undefined, []],
    ['will report the single matched child', '/a', ab, 'a', ['/a']],
    ['will report null active and every match when several apply', '/a', aa, null, ['/a', '/a']],
    ['will report null active when a scope yields competing matches', '/posts/recent', <Route to="posts/*"><Route to=":id" /><Route to="recent" /></Route>, null, ['/posts/:id', '/posts/recent']],
    ['will exclude redirect routes', '/a', <><Route to="a" redirect="/a" /><Route to="a" /></>, 'a', ['/a']],
    ['will exclude none routes', '/missing', <><Route to="a" /><Route none as={text('404')} /></>, undefined, []]
  ])('%s', async (_, path, tree, active, matches) => {
    router.current.goto(path);
    const { root } = await mount(tree);
    expect(root.active?.to ?? root.active).toBe(active);
    expect(root.matches).toEqual(matches);
  });

  it('will update active and matches on navigation', async () => {
    router.current.goto('/a');
    const { root } = await mount(ab);
    expect(root.active?.to).toBe('a');
    expect(root.matches).toEqual(['/a']);

    await visit('/b');
    expect(root.active?.to).toBe('b');
    expect(root.matches).toEqual(['/b']);
  });

  it('will see through a scope to the matched child', async () => {
    router.current.goto('/posts/recent');
    let recent!: Route;
    const { root } = await mount(
      <Route to="posts/*">
        <Route to="recent" is={(r) => (recent = r)} />
      </Route>
    );
    expect(root.active).toBe(recent);
  });
});

describe('none', () => {
  it('will match when no sibling matches, yielding on navigation', async () => {
    router.current.goto('/x');
    const { view } = await mount(
      <>
        <Route to="a" as={text('a')} />
        <Route none as={text('404')} />
      </>
    );
    expect(view.container.textContent).toBe('404');

    await visit('/a');
    expect(view.container.textContent).toBe('a');

    await visit('/missing');
    expect(view.container.textContent).toBe('404');
  });

  it('will never match without a parent', async () => {
    let lone!: Route;
    const view = await renderAct(
      <Route none as={text('lone')} is={(r) => (lone = r)} />
    );
    expect(lone.matched).toBe(false);
    expect(view.container.textContent).toBe('');
  });

  it('will take its base as path', async () => {
    router.current.goto('/docs');
    let fallback!: Route;
    await mount(
      <Route to="docs/*">
        <Route none is={(r) => (fallback = r)} as={text('404')} />
      </Route>
    );
    expect(fallback.path).toBe('/docs');
  });

  it('will be scoped to its parent (section 404 does not leak)', async () => {
    router.current.goto('/posts/recent');
    const { view } = await mount(
      <>
        <Route to="posts/*">
          <Route to="recent" as={text('recent')} />
          <Route none as={text('posts404')} />
        </Route>
        <Route none as={text('app404')} />
      </>
    );
    expect(view.container.textContent).toBe('recent');

    await visit('/posts/xyz');
    expect(view.container.textContent).toBe('posts404');

    await visit('/elsewhere');
    expect(view.container.textContent).toBe('app404');
  });

  it.each([
    ['will reach a section 404 entering from outside the section', '/posts/a/b', 'posts404'],
    ['will reach a section route entering from outside the section', '/posts/a', 'post']
  ])('%s', async (_, path, expected) => {
    router.current.goto('/');
    const { view } = await mount(
      <>
        <Route as={text('home')} />
        <Route to="posts" as={(props: { children?: ReactNode }) => <>{props.children}</>}>
          <Route to=":id" as={text('post')} />
          <Route none as={text('posts404')} />
        </Route>
        <Route none as={text('app404')} />
      </>
    );
    expect(view.container.textContent).toBe('home');

    await visit(path);
    expect(view.container.textContent).toBe(expected);
  });

  it('will see through an anonymous group - nested match suppresses sibling none Route', async () => {
    router.current.goto('/a');
    const { view } = await mount(
      <>
        <Route>
          <Route to="a" as={text('A')} />
        </Route>
        <Route none as={text('F')} />
      </>
    );
    expect(view.container.textContent).toBe('A');

    await visit('/missing');
    expect(view.container.textContent).toBe('F');
  });
});

it('will keep match identity when recompute yields equal params', async () => {
  const leaf = leafAt('/posts/foo', '/posts/:id');
  const first = leaf.match;
  expect(first).toEqual({ id: 'foo' });

  await visit('/POSTS/foo');
  expect(leaf.match).toBe(first!);
});

it('will deregister a child from parent.inner on unmount', async () => {
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

describe('a Route passed as another Route', () => {
  // The dev-repo codegen shape `<Page to="seg" as={Default}>{children}</Page>`,
  // where the outer node carries the segment/overrides and the inner (user)
  // Route is the subtree controller.
  it('will let the inner Route arbitrate and render the matched child', async () => {
    class Inner extends Route {}

    expect(await at('/sub/a', (
      <Route to="sub" as={Inner}>
        <Route to="a" as={text('A')} />
        <Route to="b" as={text('B')} />
      </Route>
    ))).toBe('A');
  });

  it('will resolve Route.get to the inner instance within its own content', async () => {
    let innerInst!: Route;
    let resolved!: Route;

    const Resolve = () => {
      resolved = Route.get().is;
      return <span>inner</span>;
    };

    class Inner extends Route {
      render() {
        innerInst = this.is;
        return <Resolve />;
      }
    }

    expect(await at('/sub', <Route to="sub" as={Inner} />)).toBe('inner');
    expect(resolved).toBeInstanceOf(Inner);
    expect(resolved).toBe(innerInst);
  });

  it('will see the outer Route\'s computed children', async () => {
    class Outer extends Route {
      protected get children() {
        return (
          <>
            {super.children}
            <Route to="extra" as={text('EXTRA')} />
          </>
        );
      }
    }
    class Inner extends Route {}

    expect(await at('/sub/extra', (
      <Outer to="sub" as={Inner}>
        <Route to="a" as={text('A')} />
      </Outer>
    ))).toBe('EXTRA');
  });

  it('will keep the inner Route\'s fallback/suspense intact', async () => {
    location('/sub');
    const pending = mockPromise<void>();
    let ready = false;
    pending.then(() => (ready = true));

    const Suspends = () => {
      if (!ready) throw pending;
      return <span>ready</span>;
    };

    class Inner extends Route {
      fallback = <span>loading</span>;
      render() {
        return <Suspends />;
      }
    }

    const view = await renderAct(<Route to="sub" as={Inner} />);
    expect(view.container.textContent).toBe('loading');

    await settled(pending, undefined);
    expect(view.container.textContent).toBe('ready');
  });
});

describe('a lazy page as `as`', () => {
  type Module = { default: (props: any) => any };

  it('will suspend into the route fallback, then resolve in place', async () => {
    location('/posts/foo');
    const module = mockPromise<Module>();
    const created = vi.fn();
    let route!: Route;

    const view = await renderAct(
      <Route
        to="/posts/:id"
        fallback={<span>loading</span>}
        as={lazy(() => module)}
        is={(r) => { created(); route = r; }}
      />
    );
    expect(view.container.textContent).toBe('loading');

    await settled(module, { default: Post });
    expect(view.container.textContent).toBe('id: foo');
    expect(created).toHaveBeenCalledTimes(1);
    expect(route.match).toEqual({ id: 'foo' });
  });

  it('will suspend within a nested scope without remounting the layout', async () => {
    location('/admin/users/7');
    const module = mockPromise<Module>();
    let mounted = 0;
    let child!: Route;

    const Counted = (props: { children?: ReactNode }) => {
      mounted++;
      return <main>{props.children}</main>;
    };

    const view = await renderAct(
      <Route to="/admin/*" as={Counted}>
        <Route
          to="users/:id"
          fallback={<span>loading</span>}
          as={lazy(() => module)}
          is={(r) => (child = r)}
        />
      </Route>
    );
    expect(view.container.querySelector('main')!.textContent).toBe('loading');
    expect(mounted).toBe(1);

    await settled(module, { default: Post });
    expect(view.container.querySelector('main')!.textContent).toBe('id: 7');
    expect(mounted).toBe(1);
    expect(child.match).toEqual({ id: '7' });
  });

  it('will resolve a lazy scope layout, then its nested children', async () => {
    location('/admin/users');
    const module = mockPromise<Module>();
    let scope!: Route;

    const view = await renderAct(
      <Route to="/admin/*" fallback={<span>loading</span>} as={lazy(() => module)} is={(r) => (scope = r)}>
        <Route to="users" as={text('users')} />
        <Route to="roles" as={text('roles')} />
      </Route>
    );
    expect(view.container.textContent).toBe('loading');
    expect(scope.inner).toEqual([]);

    await settled(module, { default: Layout });
    expect(view.container.querySelector('main')!.textContent).toBe('users');
    expect(scope.inner.map((r) => r.path)).toEqual(['/admin/users', '/admin/roles']);

    await visit('/admin/roles');
    expect(view.container.querySelector('main')!.textContent).toBe('roles');
  });

  it('will reach the Route catch when the module rejects', async () => {
    mockError();
    location('/posts/foo');
    const module = mockPromise<Module>();
    const failure = new Error('chunk load failed');
    let caught!: Error;

    class Page extends Route {
      fallback = (<span>loading</span>);

      async catch(error: Error) {
        caught = error;
        this.fallback = <span>offline</span>;
        await new Promise(() => {});
      }
    }

    const view = await renderAct(
      <Page to="/posts/:id" as={lazy(() => module)} />
    );
    expect(view.container.textContent).toBe('loading');

    await act(async () => {
      module.reject(failure);
      await module.catch(() => {});
    });
    expect(caught).toBe(failure);
    expect(view.container.textContent).toBe('offline');
  });

  it('will not mount a lazy page abandoned by navigation mid-load', async () => {
    location('/posts/foo');
    const module = mockPromise<Module>();
    const page = vi.fn(text('post'));

    const view = await renderAct(
      <>
        <Route to="/posts/:id" fallback={<span>loading</span>} as={lazy(() => module)} />
        <Route to="/about" as={text('about')} />
      </>
    );
    expect(view.container.textContent).toBe('loading');

    await visit('/about');
    expect(view.container.textContent).toBe('about');

    await settled(module, { default: page });
    expect(view.container.textContent).toBe('about');
    expect(page).not.toHaveBeenCalled();
  });
});

describe('deferred presentation', () => {
  it('will hold the current screen while the next page loads', async () => {
    location('/');
    const module = mockPromise<{ default: () => any }>();

    const view = await renderAct(
      <>
        <Route to="/" as={Home} />
        <Route to="/next" fallback={<span>loading</span>} as={lazy(() => module)} />
      </>
    );
    expect(view.container.textContent).toBe('Home');

    await visit('/next');
    expect(view.container.textContent).toBe('Home');
    expect(window.location.pathname).toBe('/');

    await settled(module, { default: () => <h1>next</h1> });
    expect(view.container.textContent).toBe('next');
    expect(window.location.pathname).toBe('/next');
  });

  it('will hold the current screen while an entry guard pends', async () => {
    location('/');
    const gate = mockPromise<string | void>();

    const view = await renderAct(
      <>
        <Route to="/" as={Home} />
        <Route to="/secret" fallback={<span>checking</span>} redirect={() => gate} as={() => <h1>secret</h1>} />
      </>
    );
    expect(view.container.textContent).toBe('Home');

    await visit('/secret');
    expect(view.container.textContent).toBe('Home');

    await act(async () => gate.resolve(undefined));
    expect(view.container.textContent).toBe('secret');
  });
});
