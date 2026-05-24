import { Context } from '@expressive/react';

import { beforeEach, describe, expect, it, render } from '../vitest';

import { Redirect } from './redirect';
import { Route } from './route';
import { Router } from './router';

beforeEach(() => {
  Context.root.get(Router, false)?.set(null);
  window.history.replaceState(null, '', '/');
});

describe('Redirect', () => {
  it('navigates on mount when inside a matched Route', () => {
    window.history.replaceState(null, '', '/legacy');
    render(
      <>
        <Route to="/legacy" as={() => <Redirect to="/new" />} />
        <Route to="/new" as={() => <h1>new</h1>} />
      </>
    );
    expect(window.location.pathname).toBe('/new');
  });

  it('does nothing when when={false}', () => {
    window.history.replaceState(null, '', '/legacy');
    render(
      <Route to="/legacy" as={() => <Redirect to="/new" when={false} />} />
    );
    expect(window.location.pathname).toBe('/legacy');
  });

  it('fires when when={true}', () => {
    window.history.replaceState(null, '', '/legacy');
    render(
      <>
        <Route to="/legacy" as={() => <Redirect to="/new" when={true} />} />
        <Route to="/new" as={() => null} />
      </>
    );
    expect(window.location.pathname).toBe('/new');
  });

  it('respects replace=true (no new history entry)', () => {
    window.history.replaceState(null, '', '/legacy');
    const before = window.history.length;
    render(
      <>
        <Route to="/legacy" as={() => <Redirect to="/new" replace />} />
        <Route to="/new" as={() => null} />
      </>
    );
    expect(window.location.pathname).toBe('/new');
    expect(window.history.length).toBe(before);
  });

  it('resolves relative `to` against the surrounding Route', () => {
    window.history.replaceState(null, '', '/posts/foo');
    render(
      <>
        <Route to="/posts/:id" as={() => <Redirect to="./edit" />} />
        <Route to="/posts/:id/edit" as={() => null} />
      </>
    );
    expect(window.location.pathname).toBe('/posts/foo/edit');
  });

  it('renders nothing', () => {
    window.history.replaceState(null, '', '/legacy');
    const view = render(
      <Route to="/legacy" as={() => <Redirect to="/legacy" when={false} />} />
    );
    expect(view.container.textContent).toBe('');
  });
});
