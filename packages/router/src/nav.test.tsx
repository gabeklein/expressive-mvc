import { act } from '@testing-library/react';
import { expect, it } from 'bun:test';

import { renderAct, browserRouter } from '../test.setup';
import { NavLinks } from './nav';
import { Route } from './route';

const router = browserRouter();

const current = (view: any) =>
  view.container.querySelector('a[aria-current="page"]')?.getAttribute('href');

const links = (view: any) =>
  Array.from(view.container.querySelectorAll('a')).map((a: any) => a.getAttribute('href'));

const Page = ({ children }: { children?: React.ReactNode }) => (
  <div>
    <NavLinks />
    {children}
  </div>
)

it('mirrors the registered route tree', async () => {
  const view = await renderAct(
    <Route as={Page}>
      <Route to="a" />
      <Route to="b" />
    </Route>
  );
  expect(links(view)).toEqual(['/a', '/b']);
});

it('default Item renders label, falling back to path', async () => {
  const view = await renderAct(
    <Route as={Page}>
      <Route to="a" label="Alpha" />
      <Route to="b" />
    </Route>
  );
  expect(links(view)).toEqual(['/a', '/b']);
  expect(view.container.textContent).toContain('Alpha');
  expect(view.container.textContent).toContain('/b');
});

it('treats a headless scope as a section, not a link', async () => {
  // `posts/*` has no `as` (no page), so the default Item renders no link for
  // it - it routes through the Group slot, which by default flattens. Its
  // child still links. (Override Group to surface a heading; see below.)
  const view = await renderAct(
    <Route as={Page}>
      <Route to="posts/*">
        <Route to="recent" />
      </Route>
    </Route>
  );
  expect(links(view)).toEqual(['/posts/recent']);
});

it('marks the active link and updates on navigation', async () => {
  router.current.goto('/a');

  const view = await renderAct(
    <Route as={Page}>
      <Route to="a" />
      <Route to="b" />
    </Route>
  );
  expect(current(view)).toBe('/a');

  await act(async () => router.current.goto('/b'));
  expect(current(view)).toBe('/b');
});

it('Item is overridable via subclassing', async () => {
  class MyNav extends NavLinks {
    Item({ route }: { route: Route }) {
      return <a href={route.path} data-custom>{route.path}</a>;
    }
  }
  const Page = ({ children }: { children?: React.ReactNode }) => (
    <div>
      <MyNav />
      {children}
    </div>
  );

  const view = await renderAct(
    <Route as={Page}>
      <Route to="a" />
    </Route>
  );
  expect(view.container.querySelector('a[data-custom]')?.getAttribute('href')).toBe('/a');
});

it('exposes route.meta to a custom Item', async () => {
  class MyNav extends NavLinks {
    Item({ route, meta }: { route: Route; meta: Route['meta'] }) {
      return <a href={route.path}>{meta?.label ?? route.path}</a>;
    }
  }
  const Page = ({ children }: { children?: React.ReactNode }) => (
    <div>
      <MyNav />
      {children}
    </div>
  );

  const view = await renderAct(
    <Route as={Page}>
      <Route to="a" meta={{ label: 'Alpha' }} />
      <Route to="b" />
    </Route>
  );
  expect(links(view)).toEqual(['/a', '/b']);
  expect(view.container.textContent).toContain('Alpha');
  expect(view.container.textContent).toContain('/b');
});

it('renders an anonymous group transparently (no stray link)', async () => {
  const view = await renderAct(
    <Route as={Page}>
      <Route>
        <Route to="a" />
        <Route to="b" />
      </Route>
    </Route>
  );
  expect(links(view)).toEqual(['/a', '/b']);
});

it('Group slot can wrap a group as a section (opt-in)', async () => {
  class Sectioned extends NavLinks {
    Group({ route, children }: { route: Route; children?: React.ReactNode }) {
      return <section data-group>{route.label}{children}</section>;
    }
  }
  const Page = ({ children }: { children?: React.ReactNode }) => (
    <div>
      <Sectioned />
      {children}
    </div>
  );

  const view = await renderAct(
    <Route as={Page}>
      <Route label="Docs">
        <Route to="a" />
      </Route>
    </Route>
  );
  const section = view.container.querySelector('section[data-group]');
  expect(section).toBeTruthy();
  expect(section!.textContent).toContain('Docs');
  expect(links(view)).toEqual(['/a']);
});

it('suspending Item takes the whole nav, not one row', async () => {
  let resolve!: () => void;
  let ready = false;
  const pending = new Promise<void>((r) => (resolve = r)).then(() => {
    ready = true;
  });

  class MyNav extends NavLinks {
    Item({ route }: { route: Route }) {
      if (route.path === '/b' && !ready) throw pending;
      return <a href={route.path}>{route.path}</a>;
    }
  }

  const Page = ({ children }: { children?: React.ReactNode }) => (
    <div>
      <span data-page />
      <MyNav />
      {children}
    </div>
  );

  const view = await renderAct(
    <Route as={Page}>
      <Route to="a" />
      <Route to="b" />
    </Route>
  );

  // Entry declares no boundary (fallback = false), so one suspending Item
  // suspends the nav as a unit - sibling rows don't render around a hole,
  // and the rest of the page is untouched.
  expect(links(view)).toEqual([]);
  expect(view.container.querySelector('[data-page]')).toBeTruthy();

  await act(async () => {
    resolve();
    await pending;
  });
  expect(links(view)).toEqual(['/a', '/b']);
});

it('NavLinks fallback shows while an Item suspends', async () => {
  let resolve!: () => void;
  let ready = false;
  const pending = new Promise<void>((r) => (resolve = r)).then(() => {
    ready = true;
  });

  class MyNav extends NavLinks {
    fallback = (<span data-pending />);

    Item({ route }: { route: Route }) {
      if (!ready) throw pending;
      return <a href={route.path}>{route.path}</a>;
    }
  }

  const Page = ({ children }: { children?: React.ReactNode }) => (
    <div>
      <MyNav />
      {children}
    </div>
  );

  const view = await renderAct(
    <Route as={Page}>
      <Route to="a" />
    </Route>
  );

  expect(view.container.querySelector('[data-pending]')).toBeTruthy();

  await act(async () => {
    resolve();
    await pending;
  });
  expect(view.container.querySelector('[data-pending]')).toBeNull();
  expect(links(view)).toEqual(['/a']);
});
