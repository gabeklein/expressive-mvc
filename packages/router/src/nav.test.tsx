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
