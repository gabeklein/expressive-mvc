import { render, screen, act } from '@testing-library/react';
import { mock, expect, it, describe } from 'bun:test';
import React from 'react';
import { observer } from '@expressive/mvc/observable';

import { mockError, mockPromise } from '../test.setup';
import { Component } from '.';

describe('error boundary', () => {
  mockError();

  it('will show fallback when child throws', async () => {
    const Throws = () => {
      throw new Error('boom');
    };

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      async catch(_error: Error) {
        // never resolves - stays in fallback
        await new Promise(() => {});
      }

      render() {
        return <Throws />;
      }
    }

    render(<Boundary />);

    expect(screen).toHaveText('Oops');
  });

  it('will recover when catch resolves', async () => {
    let shouldThrow = true;
    let resolve!: () => void;

    const MaybeThrows = () => {
      if (shouldThrow) throw new Error('boom');
      return <span>Recovered</span>;
    };

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      async catch(_error: Error) {
        await new Promise<void>((r) => {
          resolve = r;
        });
        shouldThrow = false;
      }

      render() {
        return <MaybeThrows />;
      }
    }

    render(<Boundary />);

    expect(screen).toHaveText('Oops');

    await act(async () => resolve());

    expect(screen).toHaveText('Recovered');
  });

  it('will restore fallback after catch resolves', async () => {
    let throwing: any = new Error('boom');
    let resolve!: () => void;
    let instance!: Boundary;

    class Boundary extends Component {
      value = 'initial';
      fallback = (<span>Default Loading</span>);

      new() {
        instance = this;
      }

      async catch(_error: Error) {
        this.fallback = <span>Error Fallback</span>;
        await new Promise<void>((r) => (resolve = r));
        throwing = null;
      }

      render() {
        if (throwing) throw throwing;
        return <span>{this.value}</span>;
      }
    }

    render(<Boundary />);
    await act(async () => {});

    // error boundary shows error-specific fallback
    expect(screen).toHaveText('Error Fallback');

    await act(async () => resolve());

    // error recovered, render works again
    expect(screen).toHaveText('initial');

    // suspend from render - fallback was restored so suspense uses default
    await act(async () => {
      throwing = new Promise(() => {});
      instance.value = 'trigger';
    });

    expect(screen).toHaveText('Default Loading');
  });

  it('will propagate if render throws after recovery', async () => {
    const parentCatch = mock();
    let resolve!: () => void;

    const Throws = () => {
      throw new Error('boom');
    };

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      async catch() {
        await new Promise<void>((r) => (resolve = r));
      }

      render() {
        return <Throws />;
      }
    }

    class Parent extends Component {
      fallback = (<span>Parent Caught</span>);

      async catch(error: Error) {
        parentCatch(error.message);
        await new Promise(() => {});
      }

      render() {
        return <Boundary />;
      }
    }

    render(<Parent />);

    expect(screen).toHaveText('Oops');

    // resolve catch but render will throw again
    await act(async () => resolve());

    // error propagated to parent boundary
    expect(screen).toHaveText('Parent Caught');
    expect(parentCatch).toBeCalledWith('boom');
  });

  it('will propagate catch rejection to parent boundary', async () => {
    const parentCatch = mock();

    const Throws = () => {
      throw new Error('boom');
    };

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      async catch() {
        throw new Error('recovery failed');
      }

      render() {
        return <Throws />;
      }
    }

    class Parent extends Component {
      fallback = (<span>Parent Caught</span>);

      catch(error: Error) {
        parentCatch(error.message);
        return new Promise<void>(() => {});
      }

      render() {
        return <Boundary />;
      }
    }

    render(<Parent />);

    await act(async () => {});

    expect(screen).toHaveText('Parent Caught');
    expect(parentCatch).toBeCalledWith('recovery failed');
  });

  it('will catch new error after successful recovery', async () => {
    let catchCount = 0;
    let shouldThrow = true;
    let resolve!: () => void;
    let instance!: Boundary;

    const MaybeThrows = () => {
      if (shouldThrow) throw new Error('boom');
      return <span>Recovered</span>;
    };

    class Boundary extends Component {
      value = 0;
      fallback = (<span>Oops</span>);

      new() {
        instance = this;
      }

      async catch() {
        catchCount++;
        await new Promise<void>((r) => (resolve = r));
      }

      render() {
        void this.value;
        return <MaybeThrows />;
      }
    }

    render(<Boundary />);

    expect(screen).toHaveText('Oops');
    expect(catchCount).toBe(1);

    // fix the error, then resolve catch
    shouldThrow = false;
    await act(async () => resolve());

    // successful recovery
    expect(screen).toHaveText('Recovered');

    // new error occurs later
    await act(async () => {
      shouldThrow = true;
      instance.value++;
    });

    // catch runs again for the new error
    expect(catchCount).toBe(2);
    expect(screen).toHaveText('Oops');
  });

  it('will pass error to catch', async () => {
    const caught = mock();

    const Throws = () => {
      throw new Error('specific error');
    };

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      async catch(error: Error) {
        caught(error);
      }

      render() {
        return <Throws />;
      }
    }

    render(<Boundary />);

    expect(caught).toBeCalledTimes(1);
    expect(caught.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(caught.mock.calls[0][0].message).toBe('specific error');
  });

  it('will recover immediately with sync catch', async () => {
    let shouldThrow = true;

    const MaybeThrows = () => {
      if (shouldThrow) throw new Error('boom');
      return <span>Recovered</span>;
    };

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      catch() {
        shouldThrow = false;
      }

      render() {
        return <MaybeThrows />;
      }
    }

    render(<Boundary />);

    await act(async () => {});

    expect(screen).toHaveText('Recovered');
  });

  it('will restore fallback after sync catch', async () => {
    let throwing: any = new Error('boom');
    let instance!: Boundary;

    class Boundary extends Component {
      value = 'initial';
      fallback = (<span>Default Loading</span>);

      new() {
        instance = this;
      }

      catch() {
        this.fallback = <span>Error Fallback</span>;
        throwing = null;
      }

      render() {
        if (throwing) throw throwing;
        return <span>{this.value}</span>;
      }
    }

    render(<Boundary />);
    await act(async () => {});

    expect(screen).toHaveText('initial');

    await act(async () => {
      throwing = new Promise(() => {});
      instance.value = 'trigger';
    });

    expect(screen).toHaveText('Default Loading');
  });

  it('will call catch exactly once per thrown error', async () => {
    const catchSpy = mock();

    const Throws = () => {
      throw new Error('boom');
    };

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      async catch(error: Error) {
        catchSpy(error);
        await new Promise(() => {});
      }

      render() {
        return <Throws />;
      }
    }

    render(<Boundary />);
    await act(async () => {});

    expect(catchSpy).toBeCalledTimes(1);
  });

  it('will propagate without catch defined', () => {
    const Throws = () => {
      throw new Error('boom');
    };

    class Inner extends Component {
      render() {
        return <Throws />;
      }
    }

    class Outer extends Component {
      fallback = (<span>Caught by outer</span>);

      async catch() {
        await new Promise(() => {});
      }

      render() {
        return <Inner />;
      }
    }

    render(<Outer />);

    expect(screen).toHaveText('Caught by outer');
  });

  it('will not error if unmounted during catch', async () => {
    const Throws = () => {
      throw new Error('boom');
    };
    const promise = mockPromise();
    let boundary!: Boundary;

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      new() {
        boundary = this;
      }

      async catch(_error: Error) {
        await promise;
      }

      render() {
        return <Throws />;
      }
    }

    const element = render(<Boundary />);

    expect(screen).toHaveText('Oops');

    await act(async () => element.unmount());

    expect(boundary.get(null)).toBe(true);

    // resolving after unmount should not throw
    const errors: Error[] = [];

    function trap(_: unknown, reason: Error) {
      errors.push(reason);
    }

    process.on('unhandledRejection', trap);
    promise.resolve();

    process.off('unhandledRejection', trap);
    expect(errors).toHaveLength(0);
  });

  for (const reactStrictMode of [false, true])
    it('will dispose instance if unmounted in error state' + (reactStrictMode ? ' (strict)' : ''), async () => {
      // React discards and retries the render pass on error, constructing a
      // fresh instance; stale attempts are superseded (disposed) right away.
      // Track lifecycle per instance - only the committed one matters here.
      const disposed = new Set<Control>();
      const made: Control[] = [];
      const Throws = () => {
        throw new Error('boom');
      };

      class Control extends Component {
        fallback = (<span>Oops</span>);

        new() {
          made.push(this);
          return () => disposed.add(this);
        }

        async catch() {
          await new Promise(() => {});
        }

        render() {
          return <Throws />;
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

  const SuspendUntil = (pending: Promise<unknown> & { done?: boolean }) => () => {
    if (!pending.done) throw pending.then(() => { pending.done = true; });
    return null;
  };

  it('will destroy instance when discarded without retry', async () => {
    const didDestroy = mock();

    class Parent extends Component {}
    class Model extends Component {
      protected new() {
        return () => didDestroy();
      }
    }

    const pending = mockPromise();
    const Sibling = SuspendUntil(pending);

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

    // Suspends on the first two render attempts, even after the promise
    // resolves - forcing two full discard-retry cycles before commit.
    const pending = mockPromise();
    let attempts = 0;
    const Sibling = () => {
      if (attempts++ < 2) throw pending;
      return null;
    };

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

    const pending = mockPromise();
    let attempts = 0;
    const Sibling = () => {
      if (attempts++ < 2) throw pending;
      return null;
    };

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

    // Each discarded attempt constructed a fresh instance; every stale one
    // was destroyed when the next attempt took its slot.
    expect(made.length).toBeGreaterThan(1);
    expect(made.filter((m) => !disposed.has(m))).toHaveLength(1);

    await act(async () => { element.unmount(); });
    expect(made.filter((m) => !disposed.has(m))).toHaveLength(0);
  });

  it('will not accumulate into parent state across retries', async () => {
    // The visible symptom of #118: a render-phase registration into parent
    // state (router Route -> parent.inner) repeated per discarded attempt.
    const registry = new Set<Model>();

    class Model extends Component {
      protected new() {
        registry.add(this);
        return () => registry.delete(this);
      }
    }

    const pending = mockPromise();
    let attempts = 0;
    const Sibling = () => {
      if (attempts++ < 2) throw pending;
      return null;
    };

    await act(async () => {
      render(
        <React.Suspense fallback={null}>
          <Model />
          <Sibling />
        </React.Suspense>
      );
    });

    await act(async () => { pending.resolve(); });

    expect(registry.size).toBe(1);
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

    const pending = mockPromise();
    let attempts = 0;
    const Sibling = () => {
      if (attempts++ < 2) throw pending;
      return null;
    };

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
