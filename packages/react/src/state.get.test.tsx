import React, { Suspense } from 'react';
import { Model } from '@expressive/mvc';
import '.';
import { Component, Context, get, set } from '@expressive/mvc';
import { pending } from '@expressive/mvc';
import * as Refresh from 'react-refresh/runtime';
import {
  vi,
  expect,
  it,
  describe,
  expectTypeOf,
  beforeEach,
  afterEach,
  type MockInstance
} from 'vitest';
import { act, render, renderHook, waitFor } from '@testing-library/react';
import { collect, mockPromise, flushMicrotasks, revisions, reactOnly } from '../test.setup';
import { Runtime } from './runtime';

function renderWith<T>(target: Model.Type | Model, hook: () => T, inner?: Model.Type) {
  return renderHook(hook, {
    wrapper: (props) => {
      let content = <Suspense fallback={null}>{props.children}</Suspense>;

      if (inner) content = <Component for={inner}>{content}</Component>;

      return target instanceof Model
        ? <Component for={target}>{content}</Component>
        : <Component for={target}>{content}</Component>;
    }
  });
}

describe('Model.get', () => {
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
    class Test extends Model {}

    const test = Test.new();
    const hook = renderWith(test, () => Test.get());

    expect(hook.result.current.is).toBe(test);
  });

  it('will refresh for values accessed', async () => {
    class Test extends Model {
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
    class Test extends Model {
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
    class Test extends Model {
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

  it('will throw if not found', () => {
    class Test extends Model {
      value = 1;
    }

    const useTest = vi.fn(() => {
      expect(() => Test.get()).toThrow('Could not find Test in context.');
    });

    renderHook(useTest);
    expect(useTest).toHaveReturned();
  });

  it('will not throw if optional', () => {
    class Test extends Model {
      value = 1;
    }

    const useTest = vi.fn(() => {
      expect(Test.get(false)).toBeUndefined();
    });

    renderHook(useTest);
    expect(useTest).toHaveReturned();
  });

  it('will not accept a function', () => {
    class Test extends Model {
      value = 1;
    }

    expectTypeOf(Test.get).toBeCallableWith(false);
    // @ts-expect-error
    expectTypeOf(Test.get).toBeCallableWith(($: Test) => $.value);
  });

  it('will not accept true', () => {
    class Test extends Model {}

    // @ts-expect-error
    expectTypeOf(Test.get).toBeCallableWith(true);
  });

  describe('over destroyed instance', () => {
    class Test extends Model {
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
      ['will render last values when optional', () => <>{Test.get(false)?.value}</>, 'foo']
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

  describe('reactive context', () => {
    class Test extends Model {
      value = 'foo';
    }

    /** Renders `Inner` under a `Component` providing `value`; `swap` re-renders with another. */
    function mount(value: Model, Inner: React.FC) {
      const view = render(
        <Component for={value}>
          <Inner />
        </Component>
      );

      const swap = (next: Model) =>
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

    it('will return undefined when instance is removed', async () => {
      class Other extends Model {}

      const didGet = vi.fn();
      const { container, swap } = mount(Test.new(), () => {
        const test = Test.get(false);
        didGet(test);
        return test?.value ?? null;
      });

      expect(container.textContent).toBe('foo');

      await swap(Other.new());

      expect(container.textContent).toBe('');
      expect(didGet).toHaveBeenLastCalledWith(undefined);
    });

    it('will throw when a required instance is removed', async () => {
      class Other extends Model {}

      const { container, swap } = mount(Test.new(), () => {
        try {
          return Test.get().value;
        } catch (err: any) {
          return err.message;
        }
      });

      expect(container.textContent).toBe('foo');

      await swap(Other.new());

      expect(container.textContent).toBe(`Could not find ${Test} in context.`);
    });

    it('will keep following an instance provided again closer', async () => {
      class Parent extends Model {
        test = new Test();
      }

      const parent = Parent.new();
      const Inner = () => Test.get().value;
      const tree = (inner?: Test) => (
        <Component for={parent}>
          <Component for={inner}>
            <Inner />
          </Component>
        </Component>
      );

      const { container, rerender } = render(tree());

      await act(async () => parent.test.value = 'bar');
      expect(container.textContent).toBe('bar');

      rerender(tree(parent.test));
      await act(async () => parent.test.value = 'baz');
      expect(container.textContent).toBe('baz');
    });

    it('will follow an ambiguous lookup', async () => {
      class Parent extends Model {
        a = new Test({ value: 'a' });
        b?: Test = undefined;
      }

      const parent = Parent.new();
      const didGet = vi.fn();

      const Inner = () => {
        const test = Test.get(false);
        didGet(test);
        return test?.value ?? 'none';
      };

      const view = render(
        <Component for={parent}>
          <Inner />
        </Component>
      );

      expect(view.container.textContent).toBe('a');

      await act(async () => {
        parent.b = new Test({ value: 'b' });
      });

      expect(view.container.textContent).toBe('none');
      expect(didGet).toHaveBeenLastCalledWith(undefined);

      await act(async () => {
        parent.b = undefined;
      });

      expect(view.container.textContent).toBe('a');
    });

    it('will track implicit replacement instance', async () => {
      class Child extends Model {
        value = 'original';
      }

      class Parent extends Model {
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
      class Nav extends Model {
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
    class Foo extends Model {
      bar = get(Bar);
    }

    class Bar extends Model {
      value = 'bar';
    }

    it('will attach peer from context', async () => {
      const bar = Bar.new();
      const hook = renderWith(bar, () => Foo.get().is.bar, Foo);

      expect(hook.result.current).toBe(bar);
    });

    it('will subscribe peer from context', async () => {
      const bar = Bar.new();
      const didRender = vi.fn();
      const hook = renderWith(bar, () => {
        didRender();
        return Foo.get().bar.value;
      }, Foo);

      expect(hook.result.current).toBe('bar');

      await act(async () => {
        bar.value = 'foo';
        await bar.set();
      });

      expect(hook.result.current).toBe('foo');
      expect(didRender).toBeCalledTimes(2);
    });

    it('will return undefined if instance not found', () => {
      class Foo extends Model {
        bar = get(Bar, false);
      }

      const hook = renderWith(Foo, () => Foo.get().bar);

      expect(hook.result.current).toBeUndefined();
    });

    it('will throw if instance not found', () => {
      class Foo extends Model {
        bar = get(Bar);

      }

      const tryToRender = () => renderWith(Foo, () => Foo.get());

      expect(tryToRender).toThrow(/Required Bar not found in context for [\w-]+\./);
    });

  });

  describe('strict mode', () => {
    it('will survive effect remount', async () => {
      class Test extends Model {
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

        class Test extends Model {
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

        class Test extends Model {
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
        class Test extends Model {
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

describe('Model.get - computed dependency', () => {
  // A component that observes BOTH a field and a computed getter derived from
  // that field used to refresh once, then freeze on its first-update value:
  // the field's change and the computed's recompute land in one dispatch tick,
  // and the batched queue dropped the second, same-tick refresh request.
  it('will refresh when observing a field and a computed derived from it', async () => {
    class Test extends Model {
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

describe('Model.get - nested dependency', () => {
  // Reading a nested reactive value through get() - a child Model's field
  // (or a map entry) - used to never refresh: the nested change fires with
  // the root's own events empty, and the refresh guard keyed on those events
  // (`if (changed.length)`, added by c0dffdbf) dropped it. Restored to
  // refresh on any observed change after the initial run.
  it('will refresh when observing a nested state field', async () => {
    class Child extends Model {
      value = 0;
    }

    class Parent extends Model {
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

reactOnly.describe('Model.get - concurrent consistency', () => {
  class Test extends Model {
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
describe('Model.get - pre-commit dispatch', () => {
  class Test extends Model {
    value = 0;
  }

  function harness(test: Test) {
    const refs: { current: any }[] = [];
    const inited: boolean[] = [];
    const effects: (() => (() => void) | void)[] = [];
    const context = new Context({ test });
    const update = vi.fn();
    let index = 0;

    Runtime.idle = () => false;
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

reactOnly.describe('Model.get - fast refresh', () => {
  it('will keep subscription when effects re-run', async () => {
    class Test extends Model {
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

reactOnly.describe('abandoned render', () => {
  it('will not hold an abandoned render', async () => {
    const live = new Set<Model>();

    class Parent extends Model {}

    class Child extends Component {
      new() {
        live.add(this);
        return () => live.delete(this);
      }

      render() {
        Parent.get();
        return null;
      }
    }

    const Wait = () => {
      throw mockPromise();
    };

    const element = render(
      <Component for={Parent}>
        <Suspense fallback={null}>
          <Child />
          <Wait />
        </Suspense>
      </Component>
    );

    element.rerender(<Component for={Parent} />);
    await act(collect);

    expect(live.size).toBe(0);
  });
});

describe('Model.get - parity', () => {
  class Foo extends Model {
    value = 'none';
  }

  it('will follow a provider replaced above a stable subtree', async () => {
    const a = Foo.new({ value: 'a' });
    const b = Foo.new({ value: 'b' });
    const didRender = vi.fn();

    const Name = () => {
      didRender();
      return <>{Foo.get().value}</>;
    };

    class Stable extends Component {
      render() {
        didRender();
        return <>{Foo.get().value}</>;
      }
    }

    const content = (
      <>
        <Name />
        <Stable />
      </>
    );

    const view = render(<Component for={a}>{content}</Component>);

    expect(view.container.textContent).toBe('aa');

    await act(async () => {
      view.rerender(<Component for={b}>{content}</Component>);
    });

    expect(view.container.textContent).toBe('bb');

    didRender.mockClear();
    a.value = 'stale';
    await expect(a).toHaveUpdated();

    expect(didRender).not.toBeCalled();
  });

  it('will refresh for an instance arriving after mount', async () => {
    class Parent extends Model {
      child?: Foo = undefined;
    }

    const parent = Parent.new();
    const Name = () => <>{Foo.get(false)?.value ?? 'missing'}</>;
    const view = render(
      <Component for={parent}>
        <Name />
      </Component>
    );

    expect(view.container.textContent).toBe('missing');

    await act(async () => {
      parent.child = new Foo({ value: 'arrived' });
    });

    expect(view.container.textContent).toBe('arrived');
  });

  it('will refresh for a provider whose for becomes defined', async () => {
    const Name = () => <>{Foo.get(false)?.value ?? 'missing'}</>;
    const content = <Name />;
    const view = render(<Component for={undefined as Foo | undefined}>{content}</Component>);

    expect(view.container.textContent).toBe('missing');

    await act(async () => {
      view.rerender(<Component for={Foo.new({ value: 'arrived' })}>{content}</Component>);
    });

    expect(view.container.textContent).toBe('arrived');
  });
});
