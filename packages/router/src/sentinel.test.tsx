import { act } from '@testing-library/react';
import { describe, expect, it } from 'bun:test';
import { Component } from '@expressive/react';

import { browserRouter, location, mockError, mockPromise, renderAct } from '../test.setup';
import { Route } from './route';
import { notFound, redirect } from './sentinel';

const router = browserRouter();

const New = () => <h1>New</h1>;

describe('redirect', () => {
  mockError();

  it('navigates when thrown from render', async () => {
    location('/old');

    const view = await renderAct(
      <Route>
        <Route to="/old" as={() => redirect('/new')} />
        <Route to="/new" as={New} />
      </Route>
    );

    expect(window.location.pathname).toBe('/new');
    expect(view.container.textContent).toBe('New');
  });

  it('replaces history by default', async () => {
    location('/old');
    const before = window.history.length;

    await renderAct(
      <Route>
        <Route to="/old" as={() => redirect('/new')} />
        <Route to="/new" as={New} />
      </Route>
    );

    expect(window.location.pathname).toBe('/new');
    expect(window.history.length).toBe(before);
  });

  it('pushes history when replace is false', async () => {
    location('/old');
    const before = window.history.length;

    await renderAct(
      <Route>
        <Route to="/old" as={() => redirect('/new', false)} />
        <Route to="/new" as={New} />
      </Route>
    );

    expect(window.location.pathname).toBe('/new');
    expect(window.history.length).toBe(before + 1);
  });

  it('resolves relative `to` against the catching Route', async () => {
    location('/posts/foo');

    await renderAct(
      <Route>
        <Route to="/posts/:id" as={() => redirect('edit')} />
        <Route to="/posts/foo/edit" as={() => <h1>Edit</h1>} />
      </Route>
    );

    expect(window.location.pathname).toBe('/posts/foo/edit');
  });

  it('navigates after suspense churn without crashing', async () => {
    location('/old');
    const promise = mockPromise();
    let loaded = false;

    const Page = () => {
      if (!loaded) throw promise;
      redirect('/new');
    };

    const view = await renderAct(
      <Route>
        <Route to="/old" as={Page} />
        <Route to="/new" as={New} />
      </Route>
    );

    expect(view.container.textContent).toBe('');

    await act(async () => {
      loaded = true;
      promise.resolve();
    });

    expect(window.location.pathname).toBe('/new');
    expect(view.container.textContent).toBe('New');
  });

  it('rethrows when the catching Route is already destroyed', async () => {
    location('/old');
    let route!: Route;

    await renderAct(<Route to="/old" is={(r) => (route = r)} as={New} />);

    let sentinel!: Error;
    try { redirect('/new'); }
    catch (error) { sentinel = error as Error; }

    route.set(null);

    expect(() => route.catch!(sentinel)).toThrow(sentinel.message);
    expect(window.location.pathname).toBe('/old');
  });
});

describe('notFound', () => {
  mockError();

  it('falls through to the default branch', async () => {
    location('/posts/junk');
    let root!: Route;

    const view = await renderAct(
      <Route is={(r) => (root = r)}>
        <Route to="/posts/:id" as={() => notFound()} />
        <Route default as={() => <h1>404</h1>} />
      </Route>
    );

    expect(view.container.textContent).toBe('404');
    expect(root.active).toBeUndefined();
  });

  it('does not affect other paths after navigation', async () => {
    location('/posts/junk');

    const Post = () => {
      const { match } = Route.get();
      if (match!.id === 'junk') notFound();
      return <h1>Post</h1>;
    };

    const view = await renderAct(
      <Route>
        <Route to="/posts/:id" as={Post} />
        <Route default as={() => <h1>404</h1>} />
      </Route>
    );

    expect(view.container.textContent).toBe('404');

    await act(async () => router.current.goto('/posts/real'));

    expect(view.container.textContent).toBe('Post');
  });
});

describe('foreign errors', () => {
  mockError();

  it('pass through to an outer boundary untouched', async () => {
    location('/old');
    const boom = new Error('boom');
    let caught: Error | undefined;

    class Outer extends Component {
      fallback = (<h1>Crashed</h1>);

      catch(error: Error) {
        caught = error;
        return new Promise<void>(() => {});
      }

      render() {
        return (
          <Route>
            <Route to="/old" as={() => { throw boom; }} />
          </Route>
        );
      }
    }

    const view = await renderAct(<Outer />);

    expect(caught).toBe(boom);
    expect(view.container.textContent).toBe('Crashed');
    expect(window.location.pathname).toBe('/old');
  });

  it('pass through non-Error throws too', async () => {
    location('/old');
    let caught: unknown;

    class Outer extends Component {
      fallback = (<h1>Crashed</h1>);

      catch(error: Error) {
        caught = error;
        return new Promise<void>(() => {});
      }

      render() {
        return (
          <Route>
            <Route to="/old" as={() => { throw 'nope'; }} />
          </Route>
        );
      }
    }

    const view = await renderAct(<Outer />);

    expect(caught).toBe('nope');
    expect(view.container.textContent).toBe('Crashed');
  });
});
