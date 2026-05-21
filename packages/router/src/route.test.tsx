import { Consumer } from '@expressive/react';

import { act, beforeEach, describe, expect, it, render } from '../vitest';

import { Route } from './route';
import { Router } from './router';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
});

const Home = () => <h1>Home</h1>;
const Post = () => {
  return (
    <Consumer for={Route}>
      {(r) => <article>id: {r.params.id}</article>}
    </Consumer>
  );
};

describe('Route', () => {
  it('mounts the page when its pattern matches', () => {
    window.history.replaceState(null, '', '/');
    const view = render(
      <Router>
        <Route to="/" as={Home} />
        <Route to="/posts/:id" as={Post} />
      </Router>
    );
    expect(view.container.textContent).toBe('Home');
  });

  it('does not mount any page when nothing matches', () => {
    window.history.replaceState(null, '', '/unknown');
    const view = render(
      <Router>
        <Route to="/" as={Home} />
      </Router>
    );
    expect(view.container.textContent).toBe('');
  });

  it('exposes params from the matched pattern', () => {
    window.history.replaceState(null, '', '/posts/foo');
    const view = render(
      <Router>
        <Route to="/posts/:id" as={Post} />
      </Router>
    );
    expect(view.container.textContent).toBe('id: foo');
  });

  it('updates in place on same-pattern navigation (instance persists)', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let mountCount = 0;
    let router!: Router;

    const Page = () => {
      mountCount++;
      return (
        <Consumer for={Route}>{(r) => <span>{r.params.id}</span>}</Consumer>
      );
    };

    const view = render(
      <Router is={(r) => (router = r)}>
        <Route to="/posts/:id" as={Page} />
      </Router>
    );

    expect(mountCount).toBe(1);
    expect(view.container.textContent).toBe('foo');

    await act(async () => router.goto('/posts/bar'));

    expect(mountCount).toBe(1);
    expect(view.container.textContent).toBe('bar');
  });

  it('fresh=true remounts the page on every URL change', async () => {
    window.history.replaceState(null, '', '/posts/foo');
    let mountCount = 0;
    let router!: Router;

    const Page = () => {
      mountCount++;
      return null;
    };

    render(
      <Router is={(r) => (router = r)}>
        <Route to="/posts/:id" as={Page} fresh />
      </Router>
    );

    expect(mountCount).toBe(1);

    await act(async () => router.goto('/posts/bar'));

    expect(mountCount).toBe(2);
  });

  it('ignores non-Route children when resolving', () => {
    window.history.replaceState(null, '', '/');
    const view = render(
      <Router>
        <div>chrome</div>
        {'text node'}
        <Route to="/" as={Home} />
      </Router>
    );
    // Only the matched Route's page renders; non-Route children are dropped.
    expect(view.container.textContent).toBe('Home');
  });

  it('defaults `as` to a children-passthrough', () => {
    window.history.replaceState(null, '', '/anything');
    const view = render(
      <Router>
        <Route to="/anything">
          <span>inline</span>
        </Route>
      </Router>
    );
    expect(view.container.textContent).toBe('inline');
  });

  it('matches when `to` is omitted (treated as empty pattern)', () => {
    window.history.replaceState(null, '', '/');
    const view = render(
      <Router>
        <Route as={Home} />
      </Router>
    );
    expect(view.container.textContent).toBe('Home');
  });

  it('default `as` renders nothing when given no children', () => {
    window.history.replaceState(null, '', '/blank');
    const view = render(
      <Router>
        <Route to="/blank" />
      </Router>
    );
    expect(view.container.textContent).toBe('');
  });
});
