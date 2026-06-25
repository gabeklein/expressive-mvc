/** @jsxImportSource preact */
import { render, screen, act } from '@testing-library/preact';
import { mock, expect, it, describe } from 'bun:test';

import { mockError, mockPromise, flushMicrotasks } from '../test.setup';
import { Component } from '.';

describe('error boundary', () => {
  mockError();

  // The boundary resets on a macrotask (see component.ts) so recovery may
  // chain several timer hops before the tree settles.
  const settle = () =>
    act(async () => {
      for (let i = 0; i < 5; i++)
        await flushMicrotasks();
    });

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
    await settle();

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
    await settle();

    // error boundary shows error-specific fallback
    expect(screen).toHaveText('Error Fallback');

    await act(async () => resolve());
    await settle();

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
    await settle();

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

    await settle();

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
    await settle();

    // successful recovery
    expect(screen).toHaveText('Recovered');

    // new error occurs later
    await act(async () => {
      shouldThrow = true;
      instance.value++;
    });
    await settle();

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

    await settle();

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
    await settle();

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

    await act(async () => void element.unmount());

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

  it('will dispose instance if unmounted in error state', async () => {
    const didDispose = mock();
    const Throws = () => {
      throw new Error('boom');
    };

    class Control extends Component {
      fallback = (<span>Oops</span>);

      new() {
        return didDispose;
      }

      async catch() {
        await new Promise(() => {});
      }

      render() {
        return <Throws />;
      }
    }

    const element = render(<Control />);

    expect(screen).toHaveText('Oops');
    expect(didDispose).not.toBeCalled();

    element.unmount();

    expect(didDispose).toBeCalled();
  });
});

