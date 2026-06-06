import { render, act } from '@testing-library/react';
import { beforeEach, expect, it } from 'bun:test';
import { Context } from '@expressive/react';

import { NavLinks } from './nav';
import { Route } from './route';
import { Router } from './router';

beforeEach(() => {
  Context.root.get(Router, false)?.set(null);
  window.history.replaceState(null, '', '/');
});

const links = (view: any) =>
  Array.from(view.container.querySelectorAll('a')).map((a: any) => a.getAttribute('href'));

it('mirrors the registered route tree', async () => {
  let view: any;
  await act(async () => {
    view = render(
      <Route as={NavLinks}>
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
      <Route as={NavLinks}>
        <Route to="posts/*">
          <Route to="recent" />
        </Route>
      </Route>
    );
  });
  expect(links(view)).toEqual(['/posts', '/posts/recent']);
});

it('Item is overridable via subclassing', async () => {
  class MyNav extends NavLinks {
    Item({ route }: { route: Route }) {
      return <a href={route.path} data-custom>{route.path}</a>;
    }
  }
  let view: any;
  await act(async () => {
    view = render(
      <Route as={MyNav}>
        <Route to="a" />
      </Route>
    );
  });
  expect(view.container.querySelector('a[data-custom]')?.getAttribute('href')).toBe('/a');
});
