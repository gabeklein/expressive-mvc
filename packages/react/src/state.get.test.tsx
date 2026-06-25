import React, { Suspense } from 'react';
import { Component, get, State, Provider, set } from '.';
import { mock, spyOn, expect, it, describe, afterEach, afterAll } from 'bun:test';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { mockPromise } from '../test.setup';

function renderWith<T>(Type: State.Type | State, hook: () => T) {
  return renderHook(hook, {
    wrapper: (props) => (
      <Provider for={Type}>
        <Suspense fallback={null}>{props.children}</Suspense>
      </Provider>
    )
  });
}

describe('State.get', () => {
  const error = spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    // expect(error).not.toBeCalled();
    error.mockReset();
  });

  afterAll(() => error.mockClear());

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
    const didRender = mock();
    const hook = renderWith(test, () => {
      didRender();
      return Test.get().foo;
    });

    expect(hook.result.current).toBe('foo');

    await act(async () => test.set({ foo: 'bar' }));

    expect(hook.result.current).toBe('bar');
    expect(didRender).toBeCalledTimes(2);
  });

  it('will not update on death event', async () => {
    class Test extends State {
      foo = 'foo';
    }

    const test = Test.new();
    const didRender = mock();
    const hook = renderWith(test, () => {
      didRender();
      return Test.get().foo;
    });

    expect(hook.result.current).toBe('foo');
    test.set(null);

    expect(didRender).toBeCalledTimes(1);
  });

  it('will throw if not found', () => {
    class Test extends State {
      value = 1;
    }

    const useTest = mock(() => {
      expect(() => Test.get()).toThrow('Could not find Test in context.');
    });

    renderHook(useTest);
    expect(useTest).toHaveReturned();
  });

  it('will not throw if optional', () => {
    class Test extends State {
      value = 1;
    }

    const useTest = mock(() => {
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
      const view = render(<Provider for={test}><></></Provider>);

      await act(async () => test.set(null));

      view.rerender(
        <Provider for={test}>
          <Consumer />
        </Provider>
      );

      return view.container.textContent;
    }

    it('will render last values', async () => {
      const text = await lateConsumer(() => <>{Test.get().value}</>);

      expect(text).toBe('foo');
      expect(error).not.toBeCalled();
    });

    it('will render last values when optional', async () => {
      const text = await lateConsumer(() => <>{Test.get(false)?.value}</>);

      expect(text).toBe('foo');
      expect(error).not.toBeCalled();
    });

    it('will evaluate factory with last values', async () => {
      const text = await lateConsumer(() => (
        <>{Test.get(($) => $.value.toUpperCase())}</>
      ));

      expect(text).toBe('FOO');
      expect(error).not.toBeCalled();
    });

    it('will keep last values in mounted consumer', async () => {
      const test = Test.new();
      const Consumer = () => <>{Test.get().value}</>;
      const view = render(
        <Provider for={test}>
          <Consumer />
        </Provider>
      );

      expect(view.container.textContent).toBe('foo');

      await act(async () => test.set(null));

      view.rerender(
        <Provider for={test}>
          <Consumer />
        </Provider>
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

    it('will select and subscribe to subvalue', async () => {
      const test = Test.new();
      const hook = renderWith(test, () => {
        return Test.get((x) => x.foo);
      });

      expect(hook.result.current).toBe(1);

      await act(async () => test.set({ foo: 2 }));

      expect(hook.result.current).toBe(2);
    });

    it('will throw if instance not found', () => {
      class Test extends State {
        value = 1;
      }

      const useTest = mock(() => {
        expect(() => Test.get((x) => x)).toThrow(
          `Could not find ${Test} in context.`
        );
      });

      renderHook(useTest);
      expect(useTest).toHaveReturned();
    });

    it('will compute output', async () => {
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
      const compute = mock();
      const didRender = mock();

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

    it('will return null', () => {
      class Test extends State {}

      const test = Test.new();
      const rendered = renderWith(test, () => Test.get(() => null));

      expect(rendered.result.current).toBe(null);
    });

    it('will convert undefined to null', () => {
      const hook = renderWith(Test, () => {
        return Test.get(() => {});
      });

      expect(hook.result.current).toBeNull();
    });

    it('will disable updates if null returned', async () => {
      const factory = mock(($: Test) => {
        void $.foo;
        return null;
      });

      const didRender = mock(() => {
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
      const didUpdateValues = mock();
      const didPushToValues = mock();

      parent.get((state) => {
        didUpdateValues(state.values.length);
      });

      render(
        <Provider for={parent}>
          <Child value="foo" />
          <Child value="bar" />
          <Child value="baz" />
        </Provider>
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

    it('will force a refresh', async () => {
      const didRender = mock();
      const didEvaluate = mock();
      let forceUpdate!: () => void;

      renderWith(Test, () => {
        didRender();
        return Test.get((_, update) => {
          didEvaluate();
          forceUpdate = update;
        });
      });

      expect(didEvaluate).toBeCalled();
      expect(didRender).toBeCalled();

      await act(async () => {
        forceUpdate();
      });

      expect(didEvaluate).toBeCalledTimes(1);
      expect(didRender).toBeCalledTimes(2);
    });

    it('will refresh without reevaluating', async () => {
      const didEvaluate = mock();
      const didRender = mock();
      let forceUpdate!: () => void;

      renderWith(Test, () => {
        didRender();
        return Test.get((_, update) => {
          didEvaluate();
          forceUpdate = update;
          // return null to stop subscription.
          return null;
        });
      });

      expect(didEvaluate).toBeCalled();
      expect(didRender).toBeCalled();

      act(forceUpdate);

      expect(didEvaluate).toBeCalledTimes(1);
      expect(didRender).toBeCalledTimes(2);
    });

    it('will refresh again after promise', async () => {
      const promise = mockPromise();
      const didRender = mock();

      let forceUpdate!: <T>(after: Promise<T>) => Promise<T>;

      const { result } = renderWith(Test, () => {
        didRender();
        return Test.get((_, update) => {
          forceUpdate = update;
          return null;
        });
      });

      expect<null>(result.current).toBe(null);
      expect(didRender).toBeCalled();

      await act(async () => {
        forceUpdate(promise);
      });

      expect(didRender).toBeCalledTimes(2);

      await act(async () => {
        promise.resolve();
      });

      expect(didRender).toBeCalledTimes(3);
    });

    it('will invoke async function', async () => {
      const promise = mockPromise();
      const didRender = mock();

      let forceUpdate!: <T>(after: () => Promise<T>) => Promise<T>;

      renderWith(Test, () => {
        didRender();
        return Test.get((_, update) => {
          forceUpdate = update;
          return null;
        });
      });

      expect(didRender).toBeCalled();

      await act(async () => {
        forceUpdate(() => promise);
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
      const didRender = mock();
      const hook = renderWith(test, () => {
        didRender();
        return Test.get(async ($) => {
          void $.foo;
          return promise;
        });
      });

      expect(didRender).toBeCalled();
      expect(hook.result.current).toBeNull();

      await act(async () => {
        promise.resolve('foobar');
      });

      expect(didRender).toBeCalledTimes(2);
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

      await act(async () => {
        promise.resolve();
      });

      expect(hook.result.current).toBe('oh no');
    });
  });

  describe('reactive context', () => {
    class Test extends State {
      value = 'foo';
    }

    it('will refresh when upstream instance is replaced', async () => {
      const test1 = Test.new();
      const test2 = Test.new();

      test1.value = 'first';
      test2.value = 'second';

      let current: State | State.Type | Record<string, any> = test1;
      const didRender = mock();

      const Inner = () => {
        didRender();
        return Test.get().value;
      };

      const element = render(
        <Provider for={current}>
          <Inner />
        </Provider>
      );

      expect(didRender).toBeCalled();
      expect(element.container.textContent).toBe('first');

      current = test2;

      await act(async () => {
        element.rerender(
          <Provider for={current}>
            <Inner />
          </Provider>
        );
      });

      expect(element.container.textContent).toBe('second');
      expect(didRender).toBeCalledTimes(2);
    });

    it('will track new instance after replacement', async () => {
      const test1 = Test.new();
      const test2 = Test.new();

      test1.value = 'first';
      test2.value = 'second';

      let current: any = test1;
      const didRender = mock();

      const Inner = () => {
        didRender();
        const { value } = Test.get();
        return value;
      };

      const element = render(
        <Provider for={current}>
          <Inner />
        </Provider>
      );

      expect(didRender).toBeCalled();
      expect(element.container.textContent).toBe('first');

      current = test2;

      await act(async () => {
        element.rerender(
          <Provider for={current}>
            <Inner />
          </Provider>
        );
      });

      expect(didRender).toBeCalledTimes(2);

      // update new instance - should trigger render
      await act(async () => {
        test2.value = 'updated';
      });

      await waitFor(() => {
        expect(didRender).toBeCalledTimes(3);
      });

      expect(element.container.textContent).toBe('updated');
    });

    it('will not track old instance after replacement', async () => {
      const test1 = Test.new();
      const test2 = Test.new();

      test1.value = 'first';
      test2.value = 'second';

      let current: any = test1;
      const didRender = mock();

      const Inner = () => {
        didRender();
        const { value } = Test.get();
        return value;
      };

      const { rerender } = render(
        <Provider for={current}>
          <Inner />
        </Provider>
      );

      current = test2;

      await act(async () => {
        rerender(
          <Provider for={current}>
            <Inner />
          </Provider>
        );
      });

      expect(didRender).toBeCalledTimes(2);

      // update old instance - should NOT trigger render
      test1.value = 'stale';
      await expect(test1).toHaveUpdated();

      expect(didRender).toBeCalledTimes(2);
    });

    it('will render null when instance is removed', async () => {
      class Other extends State {
        label = 'other';
      }

      const test = Test.new();
      const other = Other.new();

      let current: any = { test, other };
      const didRender = mock();

      const Inner = () => {
        didRender();
        return Test.get(false)?.value ?? null;
      };

      const { rerender } = render(
        <Provider for={current}>
          <Inner />
        </Provider>
      );

      expect(didRender).toBeCalled();

      // remove Test from context, keep Other
      current = { other };

      await act(async () => {
        rerender(
          <Provider for={current}>
            <Inner />
          </Provider>
        );
      });

      await waitFor(() => {
        expect(didRender).toBeCalledTimes(2);
      });
    });

    it('will refresh when implicit instance is replaced', async () => {
      class Child extends State {
        value = 'original';
      }

      class Parent extends State {
        child = new Child();
      }

      const parent = new Parent();
      const didRender = mock();

      const Inner = () => {
        didRender();
        return Child.get().value;
      };

      render(
        <Provider for={parent}>
          <Inner />
        </Provider>
      );

      expect(didRender).toBeCalled();

      await act(async () => {
        parent.child = new Child({ value: 'replaced' });
      });

      expect(didRender).toBeCalledTimes(2);

      parent.child.value = 'updated';

      await waitFor(() => {
        expect(didRender).toBeCalledTimes(3);
      });
    });

    it('will track implicit replacement instance', async () => {
      class Child extends State {
        value = 'original';
      }

      class Parent extends State {
        child = new Child();
      }

      const parent = new Parent();
      const didRender = mock();

      const Inner = () => {
        didRender();
        return Child.get().value;
      };

      const element = render(
        <Provider for={parent}>
          <Inner />
        </Provider>
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

    it('will use factory with replaced instance', async () => {
      const test1 = Test.new();
      const test2 = Test.new();

      test1.value = 'first';
      test2.value = 'second';

      let current: any = test1;
      const didCompute = mock();

      const Inner = () => {
        return Test.get(($) => {
          didCompute();
          return $.value;
        });
      };

      const { rerender } = render(
        <Provider for={current}>
          <Inner />
        </Provider>
      );

      expect(didCompute).toBeCalled();

      current = test2;

      await act(async () => {
        rerender(
          <Provider for={current}>
            <Inner />
          </Provider>
        );
      });

      expect(didCompute).toBeCalledTimes(2);
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
        <Provider for={Nav} is={(n: Nav) => void (nav = n)}>
          <Wrap>
            <Redirect />
            <Page to="/a" />
            <Page to="/b" />
          </Wrap>
        </Provider>
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
      const didRender = mock();
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

    it('will prefer parent over context', () => {
      class Parent extends State {
        child = new Child();
        value = 'foo';
      }

      class Child extends State {
        parent = get(Parent);
      }

      const { result } = renderWith(Parent, () => Parent.use().is);

      expect(result.current.child.parent).toBe(result.current);
    });
  });

  describe('strict mode', () => {
    it('will survive effect remount', async () => {
      class Test extends State {
        value = 'foo';
      }

      const test = Test.new();
      const didRender = mock();

      const Inner = () => {
        didRender();
        return Test.get().value;
      };

      const element = render(
        <React.StrictMode>
          <Provider for={test}>
            <Inner />
          </Provider>
        </React.StrictMode>
      );

      await new Promise((r) => setTimeout(r, 0));

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

        await act(async () => {
          promise.resolve('hello');
        });

        expect(hook.result.current).toBe('hello');
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

        await act(async () => {
          promise.reject('oh no');
        });

        expect(hook.result.current).toBe('oh no');
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

      it('will not suspend if already defined', async () => {
        class Test extends State {
          foobar = set<string>();
        }

        const test = Test.new();

        test.foobar = 'foo!';

        const hook = renderWith(test, () => {
          return Test.get().foobar;
        });
        expect(hook.result.current).toBe('foo!');
      });
    });
  });
});
