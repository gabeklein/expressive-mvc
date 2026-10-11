import { act } from '@testing-library/react';
import { expect, it } from 'vitest';

import { browserRouter, mockPromise, renderAct } from '../test.setup';
import { NavLinks } from './nav';
import { Route } from './route';

const router = browserRouter();

const current = (view: any) =>
  view.container.querySelector('a[aria-current="page"]')?.getAttribute('href');

const links = (view: any) =>
  Array.from(view.container.querySelectorAll('a')).map((a: any) => a.getAttribute('href'));

const page = (Nav: typeof NavLinks = NavLinks) => ({ children }: { children?: React.ReactNode }) => (
  <div>
    <span data-page />
    <Nav />
    {children}
  </div>
);

const Page = page();

it('will mirror the route tree, labelling by label then path', async () => {
  const view = await renderAct(
    <Route as={Page}>
      <Route to="a" label="Alpha" />
      <Route to="b" />
    </Route>
  );
  expect(links(view)).toEqual(['/a', '/b']);
  expect(view.container.textContent).toBe('Alpha/b');
});

it('will skip redirect and none rows', async () => {
  const view = await renderAct(
    <Route as={Page}>
      <Route to="a" />
      <Route to="old" redirect="/a" />
      <Route none as={() => <div>fallback</div>} />
    </Route>
  );
  expect(links(view)).toEqual(['/a']);
});

it('will treat a headless scope as a section, not a link', async () => {
  const view = await renderAct(
    <Route as={Page}>
      <Route to="posts/*">
        <Route to="recent" />
      </Route>
    </Route>
  );
  expect(links(view)).toEqual(['/posts/recent']);
});

it('will mark the active link and update on navigation', async () => {
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

it('will pass route and meta to an overridden Item', async () => {
  class MyNav extends NavLinks {
    Item({ route, meta }: { route: Route; meta: Route['meta'] }) {
      return <a href={route.path} data-custom>{meta?.label ?? route.path}</a>;
    }
  }

  const view = await renderAct(
    <Route as={page(MyNav)}>
      <Route to="a" meta={{ label: 'Alpha' }} />
      <Route to="b" />
    </Route>
  );
  expect(links(view)).toEqual(['/a', '/b']);
  expect(view.container.querySelectorAll('a[data-custom]').length).toBe(2);
  expect(view.container.textContent).toBe('Alpha/b');
});

it('will render an anonymous group transparently', async () => {
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

it('will wrap a group via an overridden Group slot', async () => {
  class Sectioned extends NavLinks {
    Group({ route, children }: { route: Route; children?: React.ReactNode }) {
      return <section data-group>{route.label}{children}</section>;
    }
  }

  const view = await renderAct(
    <Route as={page(Sectioned)}>
      <Route label="Docs">
        <Route to="a" />
      </Route>
    </Route>
  );
  expect(view.container.querySelector('section[data-group]')!.textContent).toBe('Docs/a');
  expect(links(view)).toEqual(['/a']);
});

it('will suspend the whole nav, not one row, when an Item suspends', async () => {
  const pending = mockPromise();
  let ready = false;
  pending.then(() => (ready = true));

  class MyNav extends NavLinks {
    Item({ route }: { route: Route }) {
      if (route.path === '/b' && !ready) throw pending;
      return <a href={route.path}>{route.path}</a>;
    }
  }

  const view = await renderAct(
    <Route as={page(MyNav)}>
      <Route to="a" />
      <Route to="b" />
    </Route>
  );
  expect(links(view)).toEqual([]);
  expect(view.container.querySelector('[data-page]')).toBeTruthy();

  await act(async () => pending.resolve());
  expect(links(view)).toEqual(['/a', '/b']);
});

it('will show NavLinks fallback while an Item suspends', async () => {
  const pending = mockPromise();
  let ready = false;
  pending.then(() => (ready = true));

  class MyNav extends NavLinks {
    fallback = (<span data-pending />);

    Item({ route }: { route: Route }) {
      if (!ready) throw pending;
      return <a href={route.path}>{route.path}</a>;
    }
  }

  const view = await renderAct(
    <Route as={page(MyNav)}>
      <Route to="a" />
    </Route>
  );
  expect(view.container.querySelector('[data-pending]')).toBeTruthy();

  await act(async () => pending.resolve());
  expect(view.container.querySelector('[data-pending]')).toBeNull();
  expect(links(view)).toEqual(['/a']);
});
