import React, { Suspense } from 'react';
import { Component, Context, get, State, set } from '.';
import { pending } from '@expressive/mvc';
import * as Refresh from 'react-refresh/runtime';
import {
  vi,
  expect,
  it,
  describe,
  beforeEach,
  afterEach,
  type MockInstance
} from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { mockPromise, flushMicrotasks, revisions, reactOnly } from '../test.setup';
import { Runtime } from './runtime';

function renderWith<T>(Type: State.Type | State, hook: () => T) {
  return renderHook(hook, {
    wrapper: (props) => (
      <Component for={Type}>
        <Suspense fallback={null}>{props.children}</Suspense>
      </Component>
    )
  });
}

describe('State.get', () => {
  let error: MockInstance<Console['error']>;

  beforeEach(() => {
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    const { calls } = error.mock;

    error.mockRestore();

    expect(calls).toEqual([]);
  });

  it('will fetch model', () => {
    class Test extends State {}

    const test = Test.new();
    const hook = renderWith(test, () => Test.get());

    expect(hook.result.current.is).toBe(test);
  });

  it('will refresh for values accessed', async () => {
    class Test extends State {
      foo = 'foo';
    }

    const test = Test.new();
    const didRender = vi.fn();
    const hook = renderWith(test, () => {
      didRender();
      return Test.get().foo;
    });

    expect(hook.result.current).toBe('foo');

    await act(async () => test.set({ foo: 'bar' }));

    expect(hook.result.current).toBe('bar');
    expect(didRender).toBeCalledTimes(2);
  });

  reactOnly.it('will transition model subscriber dispatch', async () => {
    class Test extends State {
      value = 'a';
      urgent = 0;
    }

    const test = Test.new();
    const gate = mockPromise<void>();
    const Content = () => {
      const { value } = Test.get();
      if (value === 'b') throw gate;
      return <span>{value}</span>;
    };
    const Status = () => <strong>{Test.get().urgent}</strong>;
    const view = render(
      <Component for={test}>
        <Suspense fallback={<i>loading</i>}>
          <Content />
        </Suspense>
        <Status />
      </Component>
    );

    await act(async () => {
      pending(() => {
        test.value = 'b';
      });
      test.urgent = 1;
      await Promise.resolve();
    });

    expect(view.container.textContent).toBe('a1');

    test.value = 'c';
    gate.resolve();
    await act(async () => {});

    expect(view.container.textContent).toBe('c1');
  });

  it('will not update on death event', async () => {
    class Test extends State {
      foo = 'foo';
    }

    const test = Test.new();
    const didRender = vi.fn();
    const hook = renderWith(test, () => {
      didRender();
      return Test.get().foo;
    });

    expect(hook.result.current).toBe('foo');
    test.set(null);

    expect(didRender).toBeCalledTimes(1);
  });

  it.each([
    ['plain', (T: typeof State) => T.get()],
    ['computed', (T: typeof State) => T.get((x) => x)]
  ])('will throw if not found (%s)', (_, read) => {
    class Test extends State {
      value = 1;
    }

    const useTest = vi.fn(() => {
      expect(() => read(Test)).toThrow('Could not find Test in context.');
    });

    renderHook(useTest);
    expect(useTest).toHaveReturned();
  });

  it('will not throw if optional', () => {
    class Test extends State {
      value = 1;
    }

    const useTest = vi.fn(() => {
      expect(Test.get(false)).toBeUndefined();
    });

    renderHook(useTest);
    expect(useTest).toHaveReturned();
  });

  it('will throw if expected value undefined', () => {
    class Test extends State {
      value?: number = undefined;

    }

    renderWith(Test, () => {
      expect(() => {
        void Test.get(true).value;
      }).toThrow(/[\w-]+\.value is required in this context\./);
    });
  });

  describe('over destroyed instance', () => {
    class Test extends State {
      value = 'foo';
    }

    async function lateConsumer(Consumer: React.FC) {
      const test = Test.new();
      const view = render(<Component for={test}><></></Component>);

      await act(async () => test.set(null));

      view.rerender(
        <Component for={test}>
          <Consumer />
        </Component>
      );

      return view.container.textContent;
    }

    it.each([
      ['will render last values', () => <>{Test.get().value}</>, 'foo'],
      ['will render last values when optional', () => <>{Test.get(false)?.value}</>, 'foo'],
      ['will evaluate factory with last values', () => <>{Test.get(($) => $.value.toUpperCase())}</>, 'FOO']
    ])('%s', async (_, Consumer, expected) => {
      expect(await lateConsumer(Consumer)).toBe(expected);
      expect(error).not.toBeCalled();
    });

    it('will keep last values in mounted consumer', async () => {
      const test = Test.new();
      const Consumer = () => <>{Test.get().value}</>;
      const view = render(
        <Component for={test}>
          <Consumer />
        </Component>
      );

      expect(view.container.textContent).toBe('foo');

      await act(async () => test.set(null));

      view.rerender(
        <Component for={test}>
          <Consumer />
        </Component>
      );

      expect(view.container.textContent).toBe('foo');
      expect(error).not.toBeCalled();
    });
  });

  describe('computed', () => {
    class Test extends State {
      foo = 1;
      bar = 2;
    }

    it.todo('will suspend if factory does', () => {});

    it('will compute and subscribe to output', async () => {
      const test = Test.new();
      const hook = renderWith(test, () => {
        return Test.get((x) => x.foo + x.bar);
      });

      expect(hook.result.current).toBe(3);

      await act(async () => test.set({ foo: 2 }));

      expect(hook.result.current).toBe(4);
    });

    it('will ignore updates with same result', async () => {
      const test = Test.new();
      const compute = vi.fn();
      const didRender = vi.fn();

      const hook = renderWith(test, () => {
        didRender();
        return Test.get((x) => {
          compute();
          void x.foo;
          return x.bar;
        });
      });

      expect(hook.result.current).toBe(2);
      expect(compute).toBeCalled();

      test.foo = 2;
      await expect(test).toHaveUpdated();

      // did attempt a second compute
      expect(compute).toBeCalledTimes(2);

      // compute did not trigger a new render
      expect(didRender).toBeCalledTimes(1);
      expect(hook.result.current).toBe(2);
    });

    it.each([
      ['will return null', () => null],
      ['will convert undefined to null', () => {}]
    ])('%s', (_, factory) => {
      const hook = renderWith(Test, () => Test.get(factory));

      expect(hook.result.current).toBeNull();
    });

    it('will disable updates if null returned', async () => {
      const factory = vi.fn(($: Test) => {
        void $.foo;
        return null;
      });

      const didRender = vi.fn(() => {
        return Test.get(factory);
      });

      const test = Test.new();
      const hook = renderWith(test, didRender);

      expect(didRender).toBeCalled();
      expect(hook.result.current).toBeNull();

      test.foo = 2;

      await expect(test).toHaveUpdated();

      expect(factory).toBeCalledTimes(1);
      expect(didRender).toBeCalledTimes(1);
    });

    it('will run initial callback syncronously', async () => {
      class Parent extends State {
        values = [] as string[];
      }

      type ChildProps = {
        value: string;
      };

      const Child = (props: ChildProps) =>
        Parent.get(($) => {
          didPushToValues();
          $.values = [...$.values, props.value];
          return null;
        });

      const parent = Parent.new();
      const didUpdateValues = vi.fn();
      const didPushToValues = vi.fn();

      parent.get((state) => {
        didUpdateValues(state.values.length);
      });

      render(
        <Component for={parent}>
          <Child value="foo" />
          <Child value="bar" />
          <Child value="baz" />
        </Component>
      );

      expect(didPushToValues).toBeCalledTimes(3);

      await expect(parent).toHaveUpdated();

      // Expect updates to have bunched up before new frame.
      expect(didUpdateValues).toBeCalledTimes(2);
      expect(didUpdateValues).toBeCalledWith(3);
    });
  });

  describe('force update', () => {
    class Test extends State {
      foo = 'bar';
    }

    it.each([
      ['will force a refresh', undefined],
      ['will refresh without reevaluating', null]
    ])('%s', async (_, output) => {
      const didEvaluate = vi.fn();
      const didRender = vi.fn();
      let forceUpdate!: () => void;

      renderWith(Test, () => {
        didRender();
        return Test.get((_, update) => {
          didEvaluate();
          forceUpdate = update;
          return output;
        });
      });

      await act(async () => forceUpdate());

      expect(didEvaluate).toBeCalledTimes(1);
      expect(didRender).toBeCalledTimes(2);
    });

    it.each([
      ['will refresh again after promise', (promise: Promise<unknown>) => promise],
      ['will invoke async function', (promise: Promise<unknown>) => () => promise]
    ])('%s', async (_, argument) => {
      const promise = mockPromise();
      const didRender = vi.fn();
      let forceUpdate!: (after: any) => Promise<unknown>;

      renderWith(Test, () => {
        didRender();
        return Test.get((_, update) => {
          forceUpdate = update;
          return null;
        });
      });

      await act(async () => {
        forceUpdate(argument(promise));
      });

      expect(didRender).toBeCalledTimes(2);

      await act(async () => {
        promise.resolve();
      });

      expect(didRender).toBeCalledTimes(3);
    });
  });

  describe('async', () => {
    class Test extends State {
      foo = 'bar';
    }

    it('will convert void to null', async () => {
      const promise = mockPromise<void>();

      const hook = renderWith(Test, () => {
        return Test.get(async () => promise);
      });

      await act(async () => promise.resolve(undefined));

      expect(hook.result.current).toBe(null);
    });

    it('will not subscribe to values', async () => {
      const promise = mockPromise<string>();

      const test = Test.new();
      const didRender = vi.fn();
      const hook = renderWith(test, () => {
        didRender();
        return Test.get(async ($) => {
          void $.foo;
          return promise;
        });
      });

      expect(didRender).toBeCalled();
      expect(hook.result.current).toBeNull();

      promise.resolve('foobar');
      await waitFor(() => expect(didRender).toBeCalledTimes(2));

      expect(hook.result.current).toBe('foobar');

      test.foo = 'foo';
      await expect(test).toHaveUpdated();

      expect(didRender).toBeCalledTimes(2);
    });

    it('will refresh and throw if async rejects', async () => {
      class Test extends State {}

      const promise = mockPromise();
      const hook = renderWith(Test, () => {
        try {
          Test.get(async () => {
            await promise;
            throw 'oh no';
          });
        } catch (err: any) {
          return err;
        }
      });

      expect(hook.result.current).toBeUndefined();

      promise.resolve();
      await waitFor(() => expect(hook.result.current).toBe('oh no'));
    });
  });

  describe('reactive context', () => {
    class Test extends State {
      value = 'foo';
    }

    /** Renders `Inner` under a Provider for `value`; `swap` re-renders with another. */
    function mount(value: State | Record<string, State>, Inner: React.FC) {
      const view = render(
        <Component for={value}>
          <Inner />
        </Component>
      );

      const swap = (next: State | Record<string, State>) =>
        act(async () => {
          view.rerender(
            <Component for={next}>
              <Inner />
            </Component>
          );
        });

      return { container: view.container, swap };
    }

    it('will track the replacement of an upstream instance', async () => {
      const test1 = Test.new({ value: 'first' });
      const test2 = Test.new({ value: 'second' });
      const didRender = vi.fn();

      const { container, swap } = mount(test1, () => {
        didRender();
        return Test.get().value;
      });

      expect(container.textContent).toBe('first');

      await swap(test2);

      expect(container.textContent).toBe('second');
      expect(didRender).toBeCalledTimes(2);

      test1.value = 'stale';
      await expect(test1).toHaveUpdated();

      expect(didRender).toBeCalledTimes(2);

      await act(async () => {
        test2.value = 'updated';
      });

      expect(container.textContent).toBe('updated');
      expect(didRender).toBeCalledTimes(3);
    });

    it.fails('will render null when instance is removed', async () => {
      class Other extends State {}

      const test = Test.new();
      const other = Other.new();
      const { container, swap } = mount({ test, other }, () => Test.get(false)?.value ?? null);

      await swap({ other });

      expect(container.textContent).toBe('');
    });

    it('will use factory with replaced instance', async () => {
      const didCompute = vi.fn();
      const { container, swap } = mount(Test.new({ value: 'first' }), () =>
        Test.get(($) => {
          didCompute();
          return $.value;
        })
      );

      await swap(Test.new({ value: 'second' }));

      expect(didCompute).toBeCalledTimes(2);
      expect(container.textContent).toBe('second');
    });

    it('will track implicit replacement instance', async () => {
      class Child extends State {
        value = 'original';
      }

      class Parent extends State {
        child = new Child();
      }

      const parent = new Parent();
      const didRender = vi.fn();

      const Inner = () => {
        didRender();
        return Child.get().value;
      };

      const element = render(
        <Component for={parent}>
          <Inner />
        </Component>
      );

      expect(element.container.textContent).toBe('original');
      expect(didRender).toBeCalled();

      // replace child implicitly
      await act(async () => {
        parent.child = new Child({ value: 'replaced' });
      });

      expect(element.container.textContent).toBe('replaced');
      expect(didRender).toBeCalledTimes(2);

      // update the new child - should still trigger render
      await act(async () => {
        parent.child.value = 'updated';
        await expect(parent.child).toHaveUpdated();
      });

      expect(element.container.textContent).toBe('updated');
      expect(didRender).toBeCalledTimes(3);
    });

    it('keeps a computed subscription alive after a mount-time redirect', async () => {
      // #112: a computed returning a fresh value each read (~Router.match),
      // whose source is mutated during a sibling's mount (redirect-on-mount),
      // must stay subscribed so later updates still reach subscribers.
      class Nav extends State {
        path = '/';
        get at() {
          const { path } = this;
          return () => path;
        }
      }

      class Wrap extends Component {
        nav = get(Nav);
        render(props = {} as { children?: React.ReactNode }) {
          void this.nav.at; // subscribe early, before the redirect
          return <>{props.children}</> as any;
        }
      }

      class Page extends Component {
        nav = get(Nav);
        to = '';
        get matched() {
          return this.nav.at() === this.to;
        }
        render() {
          return (this.matched ? <span>{this.to}</span> : null) as any;
        }
      }

      class Redirect extends Component {
        nav = get(Nav);
        protected new() {
          this.nav.path = '/a';
        }
        render() {
          return null;
        }
      }

      let nav!: Nav;
      const view = render(
        <Component for={Nav} is={(n: Nav) => void (nav = n)}>
          <Wrap>
            <Redirect />
            <Page to="/a" />
            <Page to="/b" />
          </Wrap>
        </Component>
      );

      await act(async () => {});
      expect(view.container.textContent).toBe('/a'); // redirect landed

      await act(async () => void (nav.path = '/b'));
      expect(view.container.textContent).toBe('/b'); // stalled before the fix
    });
  });

  describe('get instruction', () => {
    class Foo extends State {
      bar = get(Bar);
    }

    class Bar extends State {
      value = 'bar';
    }

    it('will attach peer from context', async () => {
      const bar = Bar.new();
      const hook = renderWith(bar, () => Foo.use().is.bar);

      expect(hook.result.current).toBe(bar);
    });

    it('will subscribe peer from context', async () => {
      const bar = Bar.new();
      const didRender = vi.fn();
      const hook = renderWith(bar, () => {
        didRender();
        return Foo.use().bar.value;
      });

      expect(hook.result.current).toBe('bar');

      await act(async () => {
        bar.value = 'foo';
        await bar.set();
      });

      expect(hook.result.current).toBe('foo');
      expect(didRender).toBeCalledTimes(2);
    });

    it('will return undefined if instance not found', () => {
      class Foo extends State {
        bar = get(Bar, false);
      }

      const hook = renderHook(() => Foo.use().bar);

      expect(hook.result.current).toBeUndefined();
    });

    it('will throw if instance not found', () => {
      class Foo extends State {
        bar = get(Bar);

      }

      const tryToRender = () => renderHook(() => Foo.use());

      expect(tryToRender).toThrow(/Required Bar not found in context for [\w-]+\./);
    });

  });

  describe('strict mode', () => {
    it('will survive effect remount', async () => {
      class Test extends State {
        value = 'foo';
      }

      const test = Test.new();
      const didRender = vi.fn();

      const Inner = () => {
        didRender();
        return Test.get().value;
      };

      const element = render(
        <React.StrictMode>
          <Component for={test}>
            <Inner />
          </Component>
        </React.StrictMode>
      );

      await flushMicrotasks();

      expect(element.container.textContent).toBe('foo');

      await act(async () => {
        test.value = 'bar';
      });

      expect(element.container.textContent).toBe('bar');
    });
  });

  describe('set instruction', () => {
    describe('factory', () => {
      it('will suspend if function is async', async () => {
        const promise = mockPromise<string>();

        class Test extends State {
          value = set(() => promise);
        }

        const hook = renderWith(Test, () => {
          return Test.get().value;
        });

        expect(hook.result.current).toBeNull();

        promise.resolve('hello');
        await waitFor(() => expect(hook.result.current).toBe('hello'));
      });

      it('will refresh and throw if async rejects', async () => {
        const promise = mockPromise();

        class Test extends State {
          value = set(() => promise);
        }

        const hook = renderWith(Test, () => {
          try {
            void Test.get().value;
          } catch (err: any) {
            if (err instanceof Promise) throw err;
            else return err;
          }
        });

        expect(hook.result.current).toBeNull();

        promise.reject('oh no');
        await waitFor(() => expect(hook.result.current).toBe('oh no'));
      });
    });

    describe('placeholder', () => {
      it('will suspend if value not yet assigned', async () => {
        class Test extends State {
          foobar = set<string>();
        }

        const test = Test.new();
        const hook = renderWith(test, () => {
          return Test.get().foobar;
        });

        expect(hook.result.current).toBeNull();

        // expect refresh caused by update
        await act(async () => {
          test.foobar = 'foo!';
        });

        expect(hook.result.current).toBe('foo!');
      });

    });
  });
});

describe('State.get - computed dependency', () => {
  // A component that observes BOTH a field and a computed getter derived from
  // that field used to refresh once, then freeze on its first-update value:
  // the field's change and the computed's recompute land in one dispatch tick,
  // and the batched queue dropped the second, same-tick refresh request.
  it('will refresh when observing a field and a computed derived from it', async () => {
    class Test extends State {
      n = 1;
      get double() {
        return this.n * 2;
      }
    }

    const test = Test.new();
    const hook = renderWith(test, () => {
      const state = Test.get();
      return `${state.n}/${state.double}`;
    });

    expect(hook.result.current).toBe('1/2');

    await act(async () => {
      test.n = 2;
    });

    expect(hook.result.current).toBe('2/4');

    await act(async () => {
      test.n = 3;
    });

    expect(hook.result.current).toBe('3/6');
  });
});

describe('State.get - nested dependency', () => {
  // Reading a nested reactive value through get() - a child State's field
  // (or a map entry) - used to never refresh: the nested change fires with
  // the root's own events empty, and the refresh guard keyed on those events
  // (`if (changed.length)`, added by c0dffdbf) dropped it. Restored to
  // refresh on any observed change after the initial run.
  it('will refresh when observing a nested state field', async () => {
    class Child extends State {
      value = 0;
    }

    class Parent extends State {
      child = new Child();
    }

    const parent = Parent.new();
    const didRender = vi.fn();
    const hook = renderWith(parent, () => {
      didRender();
      return Parent.get().child.value;
    });

    expect(hook.result.current).toBe(0);

    await act(async () => {
      parent.child.value = 5;
    });

    expect(hook.result.current).toBe(5);
    expect(didRender).toBeCalledTimes(2);
  });
});

reactOnly.describe('State.get - concurrent consistency', () => {
  class Test extends State {
    revision = 1;
  }

  it.each([
    [
      'across a yielded mount',
      (test: Test) => {
        test.revision = 2;
        test.revision = 3;
        test.revision = 4;
      },
      '4'
    ],
    ['for a transition write', (test: Test) => void pending(() => (test.revision = 2)), '2']
  ])('will not commit mixed revisions %s', async (_, write, last) => {
    const test = Test.new();
    const { commits, slow, reveal } = revisions(() => write(test));

    function Reader() {
      const { revision } = Test.get();
      slow();
      return <span>{revision}</span>;
    }

    const view = reveal(
      Array.from({ length: 40 }, (_, index) => <Reader key={index} />),
      { wrapper: ({ children }) => <Component for={test}>{children}</Component> }
    );

    await waitFor(() => {
      expect(view.container.querySelectorAll('span')).toHaveLength(40);
    });

    expect(new Set(commits[0]).size).toBe(1);

    await waitFor(() => {
      expect(view.container.textContent).toBe(last.repeat(40));
    });
  });
});

// Runtime is stubbed with a hand-driven lifecycle (as in runtime.test.ts) so a
// change can land strictly before vs. after commit - the ordering React itself
// won't reproduce on demand.
describe('State.get - pre-commit dispatch', () => {
  class Test extends State {
    value = 0;
  }

  function harness(test: Test) {
    const refs: { current: any }[] = [];
    const inited: boolean[] = [];
    const effects: (() => (() => void) | void)[] = [];
    const context = new Context({ test });
    const update = vi.fn();
    let index = 0;

    Runtime.useContext = (() => context) as typeof Runtime.useContext;

    Runtime.useRef = ((value: any) => {
      const ref = refs[index] || (refs[index] = { current: value });
      index++;
      return ref;
    }) as typeof Runtime.useRef;

    Runtime.useState = ((value: any) => {
      const slot = index++;
      if (!inited[slot]) {
        inited[slot] = true;
        if (typeof value === 'function') value();
      }
      return [0, update];
    }) as typeof Runtime.useState;

    Runtime.useEffect = ((fn: any) => void effects.push(fn)) as typeof Runtime.useEffect;
    Runtime.useSyncExternalStore = undefined;

    return {
      update,
      render: () => {
        index = 0;
        effects.length = 0;
        void Test.get().value;
      },
      commit: () => effects.forEach((fn) => fn())
    };
  }

  let saved: Partial<typeof Runtime>;

  beforeEach(() => void (saved = { ...Runtime }));
  afterEach(() => void Object.assign(Runtime, saved));

  it('will flush a deferred dispatch once committed', async () => {
    const test = Test.new();
    const { update, render, commit } = harness(test);

    render();
    test.value = 1;
    test.value = 2;

    await expect(test).toHaveUpdated();

    expect(update).not.toHaveBeenCalled();

    commit();

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('will dispatch immediately after commit', async () => {
    const test = Test.new();
    const { update, render, commit } = harness(test);

    render();
    commit();
    update.mockClear();

    test.value = 1;

    await expect(test).toHaveUpdated();

    expect(update).toHaveBeenCalledTimes(1);
  });
});

reactOnly.describe('State.get - fast refresh', () => {
  it('will keep subscription when effects re-run', async () => {
    class Test extends State {
      value = 1;
    }

    const test = Test.new();

    const Before = () => <>{Test.get().value}</>;
    const After = () => <>{Test.get().value * 10}</>;

    Refresh.register(Before, 'Reader');

    const element = render(
      <Component for={test}>
        <Before />
      </Component>
    );

    Refresh.register(After, 'Reader');
    await act(async () => void Refresh.performReactRefresh());

    expect(element.container.textContent).toBe('10');

    await act(async () => {
      test.value = 2;
    });

    expect(element.container.textContent).toBe('20');
  });
});
