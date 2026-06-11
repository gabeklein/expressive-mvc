import { render, screen, act } from '@testing-library/react';
import { expect, it, describe } from 'bun:test';
import React from 'react';

import { mockError, mockPromise } from './test.setup';
import { Component, set } from './src';

// Router-free model of the #118 topology: children register into a parent
// collection on init (render phase), a watcher renders from it, and screens
// swap inside a startTransition while lazily suspending - the deferred-
// presentation pattern, with no router involved.

class Parent extends Component {
  inner = set(new Set<Child>());

  fallback = false as const;
}

class Child extends Component {
  name = '';

  protected new() {
    const parent = this.get(Parent);
    parent.inner.add(this);
    parent.set('inner');
    return () => {
      parent.inner.delete(this);
      parent.set('inner');
    };
  }

  render() {
    return null;
  }
}

const Watcher = () => Parent.get((p) => <span>count:{p.inner.size}</span>);

// NavLink-alike: subscribes to properties of each child individually.
const Links = () => Parent.get((p) => (
  <span>
    {[...p.inner].map((c) => c.name).join(',')}
  </span>
));

describe('transition navigation', () => {
  it('will survive screen swap with suspense churn', async () => {
    const error = mockError();
    const pending = mockPromise();
    let attempts = 0;

    const SuspendingScreen = () => {
      if (attempts++ < 2) throw pending;
      return <Child name="b" />;
    };

    let parent!: Parent;
    const App = ({ screen: which }: { screen: number }) => (
      <Parent is={(p: Parent) => { parent = p; }}>
        <Watcher />
        <React.Suspense fallback={<i>wait</i>}>
          {which === 1 ? <Child name="a" /> : <SuspendingScreen />}
        </React.Suspense>
      </Parent>
    );

    let element!: ReturnType<typeof render>;
    await act(async () => {
      element = render(<App screen={1} />);
    });

    screen.getByText('count:1');

    // Navigate: swap screens inside a transition; new screen suspends twice.
    await act(async () => {
      React.startTransition(() => {
        element.rerender(<App screen={2} />);
      });
    });

    await act(async () => { pending.resolve(); });

    // Exactly one live registration - no stale attempts accumulated.
    screen.getByText('count:1');

    // The detonation check: poke the live parent so every listener it still
    // holds re-runs. Contact with a destroyed instance must not throw.
    await act(async () => { parent.set('inner'); });

    expect(error).not.toBeCalled();
  });

  it('will survive per-child subscriptions across churn and kill', async () => {
    const error = mockError();
    const pending = mockPromise();
    let attempts = 0;

    const SuspendingScreen = () => {
      if (attempts++ < 2) throw pending;
      return <Child name="b" />;
    };

    let parent!: Parent;
    const App = ({ screen: which }: { screen: number }) => (
      <Parent is={(p: Parent) => { parent = p; }}>
        <Links />
        <React.Suspense fallback={<i>wait</i>}>
          {which === 1 ? <Child name="a" /> : <SuspendingScreen />}
        </React.Suspense>
      </Parent>
    );

    let element!: ReturnType<typeof render>;
    await act(async () => {
      element = render(<App screen={1} />);
    });

    await act(async () => {
      React.startTransition(() => {
        element.rerender(<App screen={2} />);
      });
    });

    await act(async () => { pending.resolve(); });

    // Re-dispatch on the live parent: any listener leaked by a discarded
    // Links render now re-reads children, including killed attempts.
    await act(async () => { parent.set('inner'); });
    await act(async () => { parent.set('inner'); });

    expect(error).not.toBeCalled();
  });

});
