import { render, screen, act } from '@testing-library/react';
import { vi, expect, it, describe } from 'vitest';
import React from 'react';
import { observer } from '@expressive/mvc/observable';

import { mockError, mockPromise } from '../test.setup';
import { Component } from '.';

const Throws = () => {
  throw new Error('boom');
};

/** Component showing `fallback` while `catch` (a prototype member, if given) handles what `render` throws. */
function boundary({
  catch: onCatch,
  render = () => <Throws />,
  fallback = 'Oops'
}: {
  catch?: (this: any, error: Error, self: any) => unknown;
  render?: (this: any) => React.ReactNode;
  fallback?: string;
} = {}) {
  class Boundary extends Component {
    value = 'initial';
    fallback: React.ReactNode = (<span>{fallback}</span>);

    render() {
      return render.call(this);
    }
  }

  if (onCatch) Boundary.prototype.catch = onCatch as Component['catch'];

  return Boundary;
}

type Boundary = InstanceType<ReturnType<typeof boundary>>;

/** Child which throws until `fixed`. */
function flaky() {
  const state = { fixed: false };
  const Child = () => {
    if (!state.fixed) throw new Error('boom');
    return <span>Recovered</span>;
  };

  return Object.assign(state, { Child });
}

describe('error boundary', () => {
  mockError();

  it.each(['member', 'attribute'])('will recover through a %s catch', async (via) => {
    const child = flaky();
    const gate = mockPromise();
    const received = vi.fn();
    let instance!: Component;

    async function onCatch(error: Error, self: Component) {
      received(error, self);
      await gate;
      child.fixed = true;
    }

    const Boundary = boundary({
      catch: via === 'member' ? onCatch : undefined,
      render: () => <child.Child />
    });

    render(<Boundary is={(i) => (instance = i)} catch={via === 'attribute' ? onCatch : undefined} />);
    await act(async () => {});

    expect(screen).toHaveText('Oops');
    expect(received).toHaveBeenCalledTimes(1);
    expect(received.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(received).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }), instance);

    await act(async () => gate.resolve());

    expect(screen).toHaveText('Recovered');
  });

  it('will prefer a catch attribute over the member', () => {
    const member = vi.fn();
    const attribute = vi.fn(() => new Promise<void>(() => {}));
    const Boundary = boundary({ catch: member });

    render(<Boundary catch={attribute} />);

    expect(screen).toHaveText('Oops');
    expect(attribute).toHaveBeenCalled();
    expect(member).not.toHaveBeenCalled();
  });

  it.each(['async', 'sync'])('will restore fallback after %s catch', async (mode) => {
    const gate = mockPromise();
    let throwing: any = new Error('boom');
    let instance!: Boundary;

    const Boundary = boundary({
      catch() {
        this.fallback = <span>Error Fallback</span>;

        if (mode === 'sync') throwing = null;
        else return gate.then(() => (throwing = null));
      },
      render() {
        if (throwing) throw throwing;
        return <span>{this.value}</span>;
      }
    });

    render(<Boundary is={(i) => (instance = i)} />);
    await act(async () => {});

    if (mode === 'async') {
      expect(screen).toHaveText('Error Fallback');
      await act(async () => gate.resolve());
    }

    expect(screen).toHaveText('initial');

    await act(async () => {
      throwing = new Promise(() => {});
      instance.value = 'trigger';
    });

    expect(screen).toHaveText('Oops');
  });

  it.each([
    ['render throws after recovery', 'boom', () => mockPromise()],
    ['catch rejects', 'recovery failed', () => Promise.reject(new Error('recovery failed'))]
  ])('will propagate to parent boundary if %s', async (_, message, recover) => {
    const parentCatch = vi.fn();
    let pending!: Promise<unknown> & { resolve?: () => void };

    const Inner = boundary({ catch: () => (pending = recover()) });
    const Parent = boundary({
      fallback: 'Parent Caught',
      catch(error) {
        parentCatch(error.message);
        return new Promise<void>(() => {});
      },
      render: () => <Inner />
    });

    render(<Parent />);
    await act(async () => pending.resolve?.());

    expect(screen).toHaveText('Parent Caught');
    expect(parentCatch).toBeCalledWith(message);
  });

  it('will escape the root if render throws after recovery', async () => {
    const gate = mockPromise();
    const Boundary = boundary({ catch: () => gate });
    const { container } = render(<Boundary />);

    expect(screen).toHaveText('Oops');

    await expect(act(async () => gate.resolve())).rejects.toThrow('boom');

    expect(container.innerHTML).toBe('');
  });

  it('will catch new error after successful recovery', async () => {
    const child = flaky();
    let gate!: ReturnType<typeof mockPromise<void>>;
    const onCatch = vi.fn(() => (gate = mockPromise<void>()));
    let instance!: Boundary;

    const Boundary = boundary({
      catch: onCatch,
      render() {
        void this.value;
        return <child.Child />;
      }
    });

    render(<Boundary is={(i) => (instance = i)} />);

    expect(screen).toHaveText('Oops');
    expect(onCatch).toBeCalledTimes(1);

    child.fixed = true;
    await act(async () => gate.resolve());

    expect(screen).toHaveText('Recovered');

    await act(async () => {
      child.fixed = false;
      instance.value = 'again';
    });

    expect(onCatch).toBeCalledTimes(2);
    expect(screen).toHaveText('Oops');
  });

  it('will propagate without catch defined', () => {
    const Inner = boundary();
    const Outer = boundary({ fallback: 'Caught by outer', catch: () => new Promise(() => {}), render: () => <Inner /> });

    render(<Outer />);

    expect(screen).toHaveText('Caught by outer');
  });

  it('will not error if unmounted during catch', async () => {
    const gate = mockPromise();
    const Boundary = boundary({ catch: () => gate });
    let instance!: Component;

    const element = render(<Boundary is={(i) => (instance = i)} />);

    expect(screen).toHaveText('Oops');

    await act(async () => element.unmount());

    expect(instance.get(null)).toBe(true);

    await act(async () => gate.resolve());
  });

  it.each([false, true])('will dispose instance if unmounted in error state (strict: %s)', async (reactStrictMode) => {
    // React discards and retries the render pass on error, constructing a
    // fresh instance; stale attempts are superseded (disposed) right away.
    const disposed = new Set<Component>();
    const made: Component[] = [];

    class Control extends boundary({ catch: () => new Promise(() => {}) }) {
      new() {
        made.push(this);
        return () => disposed.add(this);
      }
    }

    const element = render(<Control />, { reactStrictMode });

    expect(screen).toHaveText('Oops');

    const live = made.filter((c) => !disposed.has(c));
    expect(live).toHaveLength(1);

    element.unmount();

    expect(disposed.has(live[0])).toBe(true);
  });
});

describe('discarded render (issue #118)', () => {
  // React may discard a render before commit - a sibling suspends, or
  // navigation redirects away while the fallback is showing. Effects never
  // run for discarded fibers, so teardown cannot rely on unmount alone.
  // Destruction is owned by the instance's pushed context instead: when the
  // nearest committed ancestor pops, the cascade disposes the orphan.

  /** Sibling which suspends on its first two render attempts, forcing two discard-retry cycles. */
  function retries() {
    const pending = mockPromise();
    let attempts = 0;
    const Sibling = () => {
      if (attempts++ < 2) throw pending;
      return null;
    };

    return { pending, Sibling };
  }

  it('will destroy instance when discarded without retry', async () => {
    const didDestroy = vi.fn();

    class Parent extends Component {}
    class Model extends Component {
      protected new() {
        return () => didDestroy();
      }
    }

    const pending = mockPromise();
    const Sibling = () => {
      throw pending;
    };

    let element!: ReturnType<typeof render>;
    await act(async () => {
      element = render(
        <Parent>
          <React.Suspense fallback={null}>
            <Model />
            <Sibling />
          </React.Suspense>
        </Parent>
      );
    });

    // Redirect: tree unmounts while still suspended. Model never mounted,
    // so its own unmount cleanup never runs - Parent's pop must reach it.
    await act(async () => { element.unmount(); });

    expect(didDestroy).toHaveBeenCalled();
  });

  it('will not accumulate listeners across retries', async () => {
    class Model extends Component {}

    let instance!: Model;
    await act(async () => {
      render(
        <React.Suspense fallback={null}>
          <Model is={(c: Model) => { instance = c; }} />
        </React.Suspense>
      );
    });
    const baseline = observer(instance)!.listeners.size;
    const { pending, Sibling } = retries();

    await act(async () => {
      render(
        <React.Suspense fallback={<span>loading</span>}>
          <Model is={(c: Model) => { instance = c; }} />
          <Sibling />
        </React.Suspense>
      );
    });

    expect(screen).toHaveText('loading');
    await act(async () => { pending.resolve(); });

    expect(observer(instance)!.listeners.size).toBe(baseline);
  });

  it('will supersede stale attempts, leaving one live instance at commit', async () => {
    const disposed = new Set<Model>();
    const made: Model[] = [];

    class Model extends Component {
      protected new() {
        made.push(this);
        return () => disposed.add(this);
      }
    }

    const { pending, Sibling } = retries();

    let element!: ReturnType<typeof render>;
    await act(async () => {
      element = render(
        <React.Suspense fallback={null}>
          <Model />
          <Sibling />
        </React.Suspense>
      );
    });

    await act(async () => { pending.resolve(); });

    expect(made.length).toBeGreaterThan(1);
    expect(made.filter((m) => !disposed.has(m))).toHaveLength(1);

    await act(async () => { element.unmount(); });
    expect(made.filter((m) => !disposed.has(m))).toHaveLength(0);
  });

  it('will not supersede siblings of the same class', async () => {
    const disposed = new Set<Model>();

    class Model extends Component {
      protected new() {
        return () => disposed.add(this);
      }
    }

    const all: Model[] = [];
    const keep = (c: Model) => { all.push(c); };
    const { pending, Sibling } = retries();

    await act(async () => {
      render(
        <React.Suspense fallback={null}>
          <Model is={keep} />
          <Model is={keep} />
          <Sibling />
        </React.Suspense>
      );
    });

    await act(async () => { pending.resolve(); });

    const live = new Set(all.filter((c) => !disposed.has(c)));
    expect(live.size).toBe(2);
  });
});
