/** @jsxImportSource preact */
import { StrictMode, Suspense } from 'preact/compat';
import { get, State, Provider, set } from '.';
import { mock, spyOn, expect, it, describe, afterEach, afterAll } from 'bun:test';
import { act, render, renderHook, waitFor } from '@testing-library/preact';
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

describe('State.use', () => {
  class Test extends State {
    value = 'foo';
  }

  describe('hook', () => {
    it('will create instance given a class', () => {
      const hook = renderHook(() => Test.use());

      expect(hook.result.current).toBeInstanceOf(Test);
    });

    it('will subscribe to instance of controller', async () => {
      const willRender = mock();
      const { result } = renderHook(() => {
        willRender();
        return Test.use();
      });

      expect(result.current.value).toBe('foo');
      expect(willRender).toBeCalled();

      result.current.value = 'bar';

      await waitFor(() => {
        expect(willRender).toBeCalledTimes(2);
      });

      expect(result.current.value).toBe('bar');
    });

    it('will destroy instance of given class', async () => {
      const didDestroy = mock();

      class Test extends State {
        protected new() {
          return didDestroy;
        }
      }

      const Component = () => void Test.use();

      const rendered = render(<Component />);

      rendered.unmount();

      expect(didDestroy).toBeCalled();
    });

    it('will ignore updates after unmount', async () => {
      const hook = renderHook(() => {
        const test = Test.use();
        void test.value;
        return test.is;
      });

      await act(async () => {
        hook.result.current.value = 'bar';
      });

      hook.unmount();

      expect(() => {
        hook.result.current.value = 'baz';
      }).toThrow();
    });

  });

  describe('new method', () => {
    it('will call if exists', () => {
      const didCreate = mock();

      class Test extends State {
        protected new() {
          didCreate();
        }
      }

      const element = renderHook(() => Test.use());

      expect(didCreate).toBeCalled();

      element.rerender();

      expect(didCreate).toBeCalledTimes(1);
    });
  });

  describe('use method', () => {
    it('will call every render if present', () => {
      const didUse = mock();

      class Test extends State {
        use() {
          didUse();
        }
      }

      const element = renderHook(() => Test.use());

      expect(didUse).toBeCalled();

      element.rerender();

      expect(didUse).toBeCalledTimes(2);
    });

  });

  describe('callback argument', () => {
    class Test extends State {
      foo?: string = undefined;
      bar?: string = undefined;
    }

    it('will run callback once', async () => {
      const callback = mock();
      const hook = renderHook(() => Test.use(callback));

      expect(callback).toBeCalled();

      hook.rerender(() => Test.use(callback));

      expect(callback).toBeCalledTimes(1);
    });

  });

  describe('props argument', () => {
    class Test extends State {
      foo?: string = undefined;
      bar?: string = undefined;
    }

    it('will apply props to state', async () => {
      const mockExternal = {
        foo: 'foo',
        bar: 'bar'
      };

      const didRender = mock();

      const hook = renderHook(() => {
        didRender();
        return Test.use(mockExternal);
      });

      expect(hook.result.current).toMatchObject(mockExternal);
    });

    it('will apply object every render', async () => {
      const hook = renderHook(
        ({ foo }) => {
          return Test.use({ foo, bar: 'bar' });
        },
        { initialProps: { foo: 'foo' } }
      );

      expect(hook.result.current).toMatchObject({ foo: 'foo', bar: 'bar' });

      hook.rerender({ foo: 'bar' });

      expect(hook.result.current.foo).toBe('bar');
    });

    it('will not trigger updates it caused', async () => {
      const didRender = mock();
      const hook = renderHook(
        (props) => {
          didRender();
          return Test.use(props);
        },
        { initialProps: { foo: 'foo' } }
      );

      hook.rerender({ foo: 'bar' });

      expect(didRender).toBeCalledTimes(2);
    });

  });

  describe('context', () => {
    it('will attach before model init', () => {
      class Ambient extends State {
        foo = 'foo';
      }

      class Test extends State {
        ambient = get(Ambient);

        protected new() {
          expect(this.ambient).toBeInstanceOf(Ambient);
        }
      }

      const Element = () => {
        const test = Test.use();
        expect(test.ambient.foo).toBe('foo');
        return null;
      };

      render(
        <Provider for={Ambient}>
          <Element />
        </Provider>
      );
    });
  });

  describe('strict mode', () => {
    // Note: preact's StrictMode is an alias of Fragment - no double-invoke.
    it('will create once and destroy on unmount', async () => {
      const didCreate = mock();
      const didDestroy = mock();

      class Test extends State {
        protected new() {
          didCreate();
          return didDestroy;
        }
      }

      const Component = () => {
        Test.use();
        return null;
      };

      const element = render(
        <StrictMode>
          <Component />
        </StrictMode>
      );

      await new Promise((r) => setTimeout(r, 0));

      expect(didCreate).toBeCalledTimes(1);
      expect(didDestroy).not.toBeCalled();

      element.unmount();

      expect(didDestroy).toBeCalledTimes(1);
    });

    it('will refresh via property update', async () => {
      let instance!: Test;

      class Test extends State {
        value = 'foo';

        new() {
          instance = this;
        }
      }

      const didRender = mock();

      const Component = () => {
        const test = Test.use();
        didRender(test.value);
        return <>{test.value}</>;
      };

      const element = render(
        <StrictMode>
          <Component />
        </StrictMode>
      );

      await new Promise((r) => setTimeout(r, 0));

      expect(didRender).toBeCalledWith('foo');

      await act(async () => {
        instance.value = 'bar';
      });

      expect(didRender).toBeCalledWith('bar');

      element.unmount();
    });
  });
});

describe('State.get', () => {
  const error = spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
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

    await act(async () => void await test.set({ foo: 'bar' }));

    expect(hook.result.current).toBe('bar');
    expect(didRender).toBeCalledTimes(2);
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

      await act(async () => void await test.set({ foo: 2 }));

      expect(hook.result.current).toBe(2);
    });

    it('will compute output', async () => {
      const test = Test.new();
      const hook = renderWith(test, () => {
        return Test.get((x) => x.foo + x.bar);
      });

      expect(hook.result.current).toBe(3);

      await act(async () => void await test.set({ foo: 2 }));

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

  });

  describe('async', () => {
    class Test extends State {
      foo = 'bar';
    }

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

      // preact flushes this refresh a tick later than react would
      await waitFor(() => {
        expect(didRender).toBeCalledTimes(2);
      });

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

      await waitFor(() => {
        expect(hook.result.current).toBe('oh no');
      });
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
        return <>{Test.get().value}</>;
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
        return <>{value}</>;
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
        return <>{value}</>;
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
        return <>{Test.get(false)?.value ?? null}</>;
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
        return <>{Child.get().value}</>;
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
        return <>{Child.get().value}</>;
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
        return (
          <>
            {Test.get(($) => {
              didCompute();
              return $.value;
            })}
          </>
        );
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
        return <>{Test.get().value}</>;
      };

      const element = render(
        <StrictMode>
          <Provider for={test}>
            <Inner />
          </Provider>
        </StrictMode>
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

        await waitFor(() => {
          expect(hook.result.current).toBe('hello');
        });
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

        await waitFor(() => {
          expect(hook.result.current).toBe('oh no');
        });
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
