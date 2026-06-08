import { render, act } from '@testing-library/react';
import { beforeEach, expect, it } from 'bun:test';
import { Context } from '@expressive/react';

import { NavLinks } from './nav';
import { Route } from './route';
import { Router } from './router';

const current = (view: any) =>
  view.container.querySelector('a[aria-current="page"]')?.getAttribute('href');

beforeEach(() => {
  Context.root.get(Router, false)?.set(null);
  window.history.replaceState(null, '', '/');
});

const links = (view: any) =>
  Array.from(view.container.querySelectorAll('a')).map((a: any) => a.getAttribute('href'));

const Page = ({ children }: { children?: React.ReactNode }) => (
  <div>
    <NavLinks />
    {children}
  </div>
)

it('mirrors the registered route tree', async () => {
  let view: any;
  await act(async () => {
    view = render(
      <Route as={Page}>
        <Route to="a" />
        <Route to="b" />
      </Route>
    );
  });
  expect(links(view)).toEqual(['/a', '/b']);
});

it('default Item renders label, falling back to path', async () => {
  let view: any;
  await act(async () => {
    view = render(
      <Route as={Page}>
        <Route to="a" label="Alpha" />
        <Route to="b" />
      </Route>
    );
  });
  expect(links(view)).toEqual(['/a', '/b']);
  expect(view.container.textContent).toContain('Alpha');
  expect(view.container.textContent).toContain('/b');
});

it('nests links mirroring nested Routes', async () => {
  let view: any;
  await act(async () => {
    view = render(
      <Route as={Page}>
        <Route to="posts/*">
          <Route to="recent" />
        </Route>
      </Route>
    );
  });
  expect(links(view)).toEqual(['/posts', '/posts/recent']);
});

it('marks the active link and updates on navigation', async () => {
  const router = Router.new();
  router.goto('/a');

  let view: any;
  await act(async () => {
    view = render(
      <Route as={Page}>
        <Route to="a" />
        <Route to="b" />
      </Route>
    );
  });
  expect(current(view)).toBe('/a');

  await act(async () => router.goto('/b'));
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

  let view: any;
  await act(async () => {
    view = render(
      <Route as={Page}>
        <Route to="a" />
      </Route>
    );
  });
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

  let view: any;
  await act(async () => {
    view = render(
      <Route as={Page}>
        <Route to="a" meta={{ label: 'Alpha' }} />
        <Route to="b" />
      </Route>
    );
  });
  expect(links(view)).toEqual(['/a', '/b']);
  expect(view.container.textContent).toContain('Alpha');
  expect(view.container.textContent).toContain('/b');
});

it('renders an anonymous group transparently (no stray link)', async () => {
  let view: any;
  await act(async () => {
    view = render(
      <Route as={Page}>
        <Route>
          <Route to="a" />
          <Route to="b" />
        </Route>
      </Route>
    );
  });
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

  let view: any;
  await act(async () => {
    view = render(
      <Route as={Page}>
        <Route label="Docs">
          <Route to="a" />
        </Route>
      </Route>
    );
  });
  const section = view.container.querySelector('section[data-group]');
  expect(section).toBeTruthy();
  expect(section!.textContent).toContain('Docs');
  expect(links(view)).toEqual(['/a']);
});
