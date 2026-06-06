import React from 'react';
import { act, render } from '@testing-library/react';
import { expect, it } from 'bun:test';

import { State, Component, get, Provider } from '.';

// Router-free reproduction of the redirect-on-mount navigation stall.
//
// Distilled by bisection from @expressive/router. The essential ingredients:
//  1. A source State (~Router) with a field (`path`) AND a getter that reads
//     that field and returns a FRESH value each evaluation (~Router.match,
//     which returns a new closure every read).
//  2. Two or more Components that subscribe through that fresh-value getter
//     (here a wrapper and the leaves, mirroring a parent Route + child Routes,
//     all of which read `Router.match`).
//  3. A sibling that mutates the field during the mount/commit window
//     (~redirect-on-mount via the new() lifecycle).
//
// Result: the redirect lands, but every subsequent mutation stalls - the
// subscribers never re-render. Subscribing through a stable value (e.g. reading
// the plain `path` field) instead of the fresh-value getter makes it pass.

class Nav extends State {
  path = '/';

  // ~ Router.match: reads `path`, returns a new function on every evaluation
  get matcher() {
    const { path } = this;
    return () => path;
  }
}

class Wrapper extends Component {
  nav = get(Nav);
  render(props = {} as { children?: React.ReactNode }) {
    void this.nav.matcher; // subscribe through the fresh-value getter
    return <>{props.children}</> as any;
  }
}

class Leaf extends Component {
  nav = get(Nav);
  to = '';
  get matched() {
    return this.nav.matcher() === this.to; // subscribe via the fresh-closure getter
  }
  render() {
    return (this.matched ? <span>page:{this.to}</span> : null) as any;
  }
}

class Redirector extends Component {
  nav = get(Nav);
  protected new() {
    this.nav.path = '/a'; // redirect-on-mount
  }
  render() {
    return null;
  }
}

it('navigation stalls after a redirect-on-mount (router-free)', async () => {
  let nav!: Nav;

  const view = render(
    <Provider for={Nav} is={(n: Nav) => { nav = n; }}>
      <Wrapper>
        <Redirector />
        <Leaf to="/a" />
        <Leaf to="/b" />
      </Wrapper>
    </Provider>
  );

  await act(async () => {});
  expect(view.container.textContent).toBe('page:/a'); // redirect landed

  await act(async () => { nav.path = '/b'; });
  expect(view.container.textContent).toBe('page:/b'); // <- stays 'page:/a'
});
