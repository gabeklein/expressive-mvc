import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { browserRouter, location, renderAct } from '../test.setup';
import { Redirect } from './redirect';
import { Route } from './route';

browserRouter();

describe('Redirect', () => {
  it('will push on mount inside a matched Route', async () => {
    location('/legacy');
    const before = window.history.length;
    await renderAct(
      <>
        <Route to="/legacy" as={() => <Redirect to="/new" />} />
        <Route to="/new" as={() => <h1>new</h1>} />
      </>
    );
    expect(window.location.pathname).toBe('/new');
    expect(window.history.length).toBe(before + 1);
  });

  it('will not navigate when when={false}', () => {
    location('/legacy');
    render(
      <Route to="/legacy" as={() => <Redirect to="/new" when={false} />} />
    );
    expect(window.location.pathname).toBe('/legacy');
  });

  it('will replace history when replace', async () => {
    location('/legacy');
    const before = window.history.length;
    await renderAct(
      <>
        <Route to="/legacy" as={() => <Redirect to="/new" replace />} />
        <Route to="/new" as={() => null} />
      </>
    );
    expect(window.location.pathname).toBe('/new');
    expect(window.history.length).toBe(before);
  });

  it('will resolve relative `to` against the surrounding Route', async () => {
    location('/posts/foo');
    await renderAct(
      <>
        <Route to="/posts/:id" as={() => <Redirect to="./edit" />} />
        <Route to="/posts/:id/edit" as={() => null} />
      </>
    );
    expect(window.location.pathname).toBe('/posts/foo/edit');
  });
});
