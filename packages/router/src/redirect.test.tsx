import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import { Redirect } from './redirect';
import { Route } from './route';
import { BrowserRouter } from './router';

let router: BrowserRouter;

afterEach(() => {
  router!.set(null);
});

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  router = BrowserRouter.new();
})

describe('Redirect', () => {
  it('navigates on mount when inside a matched Route', async () => {
    window.history.replaceState(null, '', '/legacy');
    await act(async () => {
      render(
        <>
          <Route to="/legacy" as={() => <Redirect to="/new" />} />
          <Route to="/new" as={() => <h1>new</h1>} />
        </>
      );
    });
    expect(window.location.pathname).toBe('/new');
  });

  it('does nothing when when={false}', () => {
    window.history.replaceState(null, '', '/legacy');
    render(
      <Route to="/legacy" as={() => <Redirect to="/new" when={false} />} />
    );
    expect(window.location.pathname).toBe('/legacy');
  });

  it('fires when when={true}', async () => {
    window.history.replaceState(null, '', '/legacy');
    await act(async () => {
      render(
        <>
          <Route to="/legacy" as={() => <Redirect to="/new" when={true} />} />
          <Route to="/new" as={() => null} />
        </>
      );
    });
    expect(window.location.pathname).toBe('/new');
  });

  it('respects replace=true (no new history entry)', async () => {
    window.history.replaceState(null, '', '/legacy');
    const before = window.history.length;
    await act(async () => {
      render(
        <>
          <Route to="/legacy" as={() => <Redirect to="/new" replace />} />
          <Route to="/new" as={() => null} />
        </>
      );
    });
    expect(window.location.pathname).toBe('/new');
    expect(window.history.length).toBe(before);
  });

  it('resolves relative `to` against the surrounding Route', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    await act(async () => {
      render(
        <>
          <Route to="/posts/:id" as={() => <Redirect to="./edit" />} />
          <Route to="/posts/:id/edit" as={() => null} />
        </>
      );
    });
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
