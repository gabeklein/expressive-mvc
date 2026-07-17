import React from 'react';
import { describe, expect, it, mock } from 'bun:test';
import { State, Provider, get, set } from '.';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { flushMicrotasks, mockError } from '../test.setup';

describe('State.use', () => {
  class Test extends State {
    value = 'foo';
  }

  describe('hook', () => {
    it('will create instance given a class', () => {
      const hook = renderHook(() => Test.use());

      expect(hook.result.current).toBeInstanceOf(Test);
    });

    it('will throw if local state suspends', () => {
      mockError();

      class Pending extends State {
        value = set<string>();
      }

      const View = () => Pending.use().value;

      expect(() => render(<View />)).toThrow(
        'State.use() cannot suspend. Resolve async values before creating local State or read them from context with State.get().'
      );
    });

    it('will throw if nested local state suspends', () => {
      mockError();

      class Pending extends State {
        value = set<string>();
      }

      class Parent extends State {
        child = Pending.new();
      }

      const View = () => Parent.use().child.value;

      expect(() => render(<View />)).toThrow('State.use() cannot suspend.');
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

    it('will assign `is` as a circular reference', async () => {
      const { result } = renderHook(() => Test.use());

      expect(result.current.value).toBe('foo');

      await act(async () => {
        result.current.is.value = 'bar';
      });

      expect(result.current.value).toBe('bar');
    });

    it('will run callback', () => {
      const callback = mock();

      renderHook(() => Test.use(callback));

      expect(callback).toBeCalledWith(expect.any(Test));
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

    it('will bind methods to instance', async () => {
      class Test extends State {
        current = 0;

        action() {
          this.current++;
        }
      }

      const hook = renderHook(() => {
        const { action, current } = Test.use();

        action();

        return current;
      });

      expect(hook.result.current).toBe(0);

      hook.rerender();

      expect(hook.result.current).toBe(1);

      hook.unmount();
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

    it('will receive arguments', () => {
      const didUse = mock();

      class Test extends State {
        use(foo: string, bar: number) {
          didUse(foo, bar);
        }
      }

      renderHook(() => Test.use('hello', 123));

      expect(didUse).toBeCalledWith('hello', 123);
    });

    it('will divert arguments from constructor', () => {
      const didUse = mock();

      class Test extends State {
        value = 0;
      }

      class Test2 extends Test {
        use(props: { value: number }) {
          didUse(props);
          expect(this.value).not.toBe(props.value);
        }
      }

      const test = renderHook(() => Test.use({ value: 42 }));
      const test2 = renderHook(() => Test2.use({ value: 42 }));

      expect(test.result.current.value).toBe(42);
      expect(test2.result.current.value).not.toBe(42);
      expect(didUse).toBeCalledWith({ value: 42 });
    });

    it('will enforce signature', () => {
      class Test extends State {
        use(foo: string, bar: number) {}
      }

      void function test() {
        // @ts-expect-error
        Test.use();
      };
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

    it('will run argument before effects', () => {
      const effect = mock();
      const argument = mock(() => {
        expect(effect).not.toBeCalled();
      });

      class Test extends State {
        constructor(...args: State.Args) {
          super(args);
          this.get(effect);
        }
      }

      renderHook(() => {
        Test.use(argument);
      });

      expect(argument).toBeCalled();
      expect(effect).toBeCalled();
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

    it('will apply callback only once', async () => {
      const hook = renderHook(() => {
        return Test.use(() => ({ foo: 'foo', bar: 'bar' }));
      });

      expect(hook.result.current).toMatchObject({ foo: 'foo', bar: 'bar' });

      await expect(hook.result.current).not.toHaveUpdated();

      hook.rerender(() => {
        return Test.use({ foo: 'bar', bar: 'foo' });
      });

      await expect(hook.result.current).not.toHaveUpdated();

      await act(async () => {
        hook.result.current.foo = 'bar';
      });

      expect(hook.result.current.foo).toBe('bar');
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

    it('will apply props over (untracked) arrow functions', () => {
      class Test extends State {
        foobar = () => 'Hello world!';
      }

      const mockExternal = {
        foobar: () => 'Goodbye cruel world!'
      };

      const hook = renderHook(() => {
        return Test.use(mockExternal);
      });

      const { foobar } = hook.result.current;

      expect(foobar).toBe(mockExternal.foobar);
    });

    it('will not apply props over methods', () => {
      class Test extends State {
        foobar() {
          return 'Hello world!';
        }
      }

      const mockProps = {
        foobar: () => 'Goodbye cruel world!'
      };

      const { result } = renderHook(() => {
        return Test.use(mockProps);
      });

      expect(result.current).not.toBe(mockProps.foobar);
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

    it('will trigger set instruction', () => {
      const cb = mock();

      class Test extends State {
        foo = set('foo', cb);
      }

      const { result } = renderHook(() => {
        return Test.use({ foo: 'bar' });
      });

      expect(result.current.foo).toBe('bar');
      expect(cb).toBeCalledWith('bar', 'foo');
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
        <React.StrictMode>
          <Component />
        </React.StrictMode>
      );

      await flushMicrotasks();

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
        return test.value;
      };

      const element = render(
        <React.StrictMode>
          <Component />
        </React.StrictMode>
      );

      await flushMicrotasks();

      expect(didRender).toBeCalledWith('foo');

      await act(async () => {
        instance.value = 'bar';
      });

      expect(didRender).toBeCalledWith('bar');

      element.unmount();
    });
  });
});
