import React, { Suspense } from 'react';
import { renderToString } from 'react-dom/server';
import {
  vi,
  afterEach,
  beforeEach,
  expect,
  it,
  describe,
  type MockInstance
} from 'vitest';

import { act, render, screen } from '@testing-library/react';
import { Component, State, Context, get, Provider, set } from '.';
import { flushMicrotasks, preactDiffers } from '../test.setup';

let error: MockInstance<Console['error']>;

beforeEach(() => {
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  const { calls } = error.mock;

  error.mockRestore();

  expect(calls).toEqual([]);
});

class Foo extends State {
  value?: string = undefined;
}
class Bar extends State {}
class Baz extends Bar {}

/** Renders a checker into `wrap`, running `assert` there and proving the checker rendered. */
function within(assert: () => void, wrap: (check: React.ReactNode) => React.ReactNode) {
  const Check = vi.fn(() => (assert(), null));

  render(<>{wrap(<Check />)}</>);

  expect(Check).toHaveBeenCalled();
}

describe('Provider', () => {
  it('will be owned by enclosing Component', () => {
    let host!: State;
    let provided!: State;

    class Host extends Component {
      render() {
        return <Provider for={Foo} is={(foo) => (provided = foo)} />;
      }
    }

    render(<Host is={(h) => (host = h)} />);

    expect(provided.get(State)).toBe(host);
  });

  it('will provide a mix of state and models', () => {
    const foo = Foo.new();

    within(
      () => {
        expect(Foo.get().is).toBe(foo);
        expect(Bar.get()).toBeInstanceOf(Bar);
      },
      (check) => <Provider for={{ foo, Bar }}>{check}</Provider>
    );
  });

  it('will pass props and is callback to created instance', () => {
    class Test extends State {
      foo = 'default';
      bar = 0;
    }

    const is = vi.fn();

    within(
      () => expect(Test.get()).toMatchObject({ foo: 'hello', bar: 42 }),
      (check) => (
        <Provider for={Test} is={is} foo="hello" bar={42}>
          {check}
        </Provider>
      )
    );

    expect(is).toBeCalledTimes(1);
    expect(is).toBeCalledWith(expect.any(Test));
  });

  it('will apply unmanaged _ props alongside is', () => {
    class Config extends State {
      _mode = 'light';
    }

    const is = vi.fn<(instance: Config) => void>();

    render(<Provider for={Config} is={is} _mode="dark" />);

    expect(is.mock.calls[0][0]._mode).toBe('dark');
  });

  it('will use the current is for a later registration', () => {
    class First extends State {}
    class Second extends State {}

    const seen: string[] = [];

    const element = render(
      <Provider for={First} is={() => seen.push('first')}>
        <span />
      </Provider>
    );

    element.rerender(
      <Provider for={Second} is={() => seen.push('second')}>
        <span />
      </Provider>
    );

    expect(seen).toEqual(['first', 'second']);
  });

  it('will stop applying rest props when for becomes multi-form', () => {
    class Test extends State {
      foo = 'default';
    }

    const seen: Test[] = [];
    const capture = (state: Test) => {
      seen.push(state);
    };

    const element = render(
      <Provider for={Test} is={capture} foo="hello">
        <span />
      </Provider>
    );

    expect(seen[0].foo).toBe('hello');

    // the single instance is replaced by a map-registered one, which rest props
    // never apply to - the departed instance must not keep receiving them
    element.rerender(
      <Provider for={{ Test }} is={capture} foo="ignored">
        <span />
      </Provider>
    );

    expect(seen).toHaveLength(2);
    expect(seen[1].foo).toBe('default');
  });

  it('will update instance when props change', async () => {
    class Test extends State {
      value = 'initial';
    }

    const Child = () => <span>{Test.get().value}</span>;

    const element = render(
      <Provider for={Test} value="first">
        <Child />
      </Provider>
    );

    expect(screen).toHaveText('first');

    act(() => {
      element.rerender(
        <Provider for={Test} value="second">
          <Child />
        </Provider>
      );
    });

    expect(screen).toHaveText('second');
  });

  it('will pass props to instance', () => {
    const test = Foo.new();

    within(
      () => {
        const { is } = Foo.get();

        expect(is).toBe(test);
        expect(is.value).toBe('hello');
      },
      (check) => (
        <Provider for={test} value="hello">
          {check}
        </Provider>
      )
    );
  });

  it('will destroy only created models on unmount', async () => {
    const willDestroy = vi.fn();

    class Foo extends State {}
    class Bar extends State {}
    class Given extends State {}

    const instance = Given.new();

    function Check() {
      Foo.get().get(() => willDestroy);
      Bar.get().get(() => willDestroy);
      Given.get().get(() => willDestroy);
      return null;
    }

    const element = render(
      <Provider for={{ Foo, Bar, instance }}>
        <Check />
      </Provider>
    );

    element.unmount();

    expect(willDestroy).toBeCalledTimes(2);
    expect(instance.get(null)).toBe(false);
  });

  it('will destroy from bottom-up', async () => {
    const didDestroy = vi.fn();

    class Test extends State {
      protected new() {
        return () => didDestroy(this.constructor.name);
      }
    }

    class Parent extends Test {}
    class Child extends Test {}

    const element = render(
      <Provider for={Parent}>
        <Provider for={Child} />
      </Provider>
    );

    element.unmount();

    expect(didDestroy.mock.calls).toEqual([['Child'], ['Parent']]);
  });

  describe('mount method', () => {
    it('will call for an instance it creates', () => {
      const didMount = vi.fn();
      const didUnmount = vi.fn();

      class Test extends State {
        mount() {
          didMount();
          return didUnmount;
        }
      }

      const element = render(
        <Provider for={Test}>
          <span />
        </Provider>
      );

      expect(didMount).toBeCalledTimes(1);
      expect(didUnmount).not.toBeCalled();

      element.unmount();

      expect(didUnmount).toBeCalledTimes(1);
    });

    it('will not repeat under strict mode', () => {
      const didMount = vi.fn();
      const didUnmount = vi.fn();

      class Test extends State {
        mount() {
          didMount();
          return didUnmount;
        }
      }

      const element = render(
        <Provider for={Test}>
          <span />
        </Provider>,
        { reactStrictMode: true }
      );

      expect(didMount).toBeCalledTimes(1);

      element.unmount();

      expect(didUnmount).toBeCalledTimes(1);
    });

    it('will not call for an instance it is given', () => {
      const didMount = vi.fn();

      class Owned extends State {
        mount() {
          didMount('owned');
        }
      }

      class Guest extends State {
        mount() {
          didMount('guest');
        }
      }

      const guest = Guest.new();
      const element = render(
        <Provider for={{ Owned, guest }}>
          <span />
        </Provider>
      );

      expect(didMount.mock.calls).toEqual([['owned']]);

      element.unmount();

      expect(guest.get(null)).toBe(false);
    });

    it('will not mount a state swapped in by a later render', () => {
      const didMount = vi.fn();

      class First extends State {
        mount() {
          didMount('first');
        }
      }

      class Second extends State {
        mount() {
          didMount('second');
        }
      }

      const element = render(
        <Provider for={First}>
          <span />
        </Provider>
      );

      expect(didMount.mock.calls).toEqual([['first']]);

      // mount belongs to the Provider's own commit, so a `for` replaced
      // mid-life provides Second without ever mounting it
      element.rerender(
        <Provider for={Second}>
          <span />
        </Provider>
      );

      expect(didMount.mock.calls).toEqual([['first']]);
    });

    it('will mount a swapped state when the Provider is keyed', () => {
      const didMount = vi.fn();

      class First extends State {
        mount() {
          didMount('first');
        }
      }

      class Second extends State {
        mount() {
          didMount('second');
        }
      }

      const element = render(
        <Provider key="first" for={First}>
          <span />
        </Provider>
      );

      expect(didMount.mock.calls).toEqual([['first']]);

      // a new key is a new Provider, so the swap mounts as any first commit does
      element.rerender(
        <Provider key="second" for={Second}>
          <span />
        </Provider>
      );

      expect(didMount.mock.calls).toEqual([['first'], ['second']]);
    });

    it('will mount after descendants, as any parent does', () => {
      const order: string[] = [];

      class Outer extends State {
        mount() {
          order.push('provided');
        }
      }

      class Inner extends State {
        mount() {
          order.push('child');
        }
      }

      const Child = () => {
        Inner.use();
        return <span />;
      };

      render(
        <Provider for={Outer}>
          <Child />
        </Provider>
      );

      expect(order).toEqual(['child', 'provided']);
    });
  });

  describe('forEach prop', () => {
    it('will ignore a returned value', () => {
      let captured!: Foo | Bar;
      // a concise arrow body returns the state, which must not be mistaken
      // for a teardown - hence no dispose seam here at all
      const forEach = vi.fn((state: Foo | Bar) => (captured = state));

      const rendered = render(<Provider for={{ Foo, Bar }} is={forEach} />);

      expect(forEach).toBeCalledTimes(2);
      expect(captured).toBeInstanceOf(State);

      expect(() => rendered.unmount()).not.toThrow();
    });

    it('will call for each model and cleanup through the state', () => {
      const cleanup = vi.fn();
      const forEach = vi.fn((state: State) => {
        state.set(null, cleanup);
      });

      const rendered = render(<Provider for={{ Foo, Bar }} is={forEach} />);

      expect(forEach).toBeCalledTimes(2);
      expect(forEach).toBeCalledWith(expect.any(Foo));
      expect(forEach).toBeCalledWith(expect.any(Bar));
      expect(cleanup).not.toBeCalled();

      rendered.unmount();

      expect(cleanup).toBeCalledTimes(2);
    });
  });

  describe('suspense', () => {
    it('will render fallback prop', async () => {
      class Foo extends State {
        value = set<string>();
      }

      const foo = Foo.new();
      const Consumer = () => Foo.get().value;

      const element = render(
        <Provider for={foo} fallback={<span>Loading...</span>}>
          <Consumer />
        </Provider>
      );

      expect(element).toHaveText('Loading...');

      await act(async () => {
        foo.value = 'Hello World';
      });

      expect(element).toHaveText('Hello World');
      expect(element).not.toHaveText('Loading...');
    });

    preactDiffers('will ignore suspense if undefined', () => {
      class Foo extends State {
        value = set<string>();
      }

      const foo = Foo.new();
      const Consumer = () => Foo.get().value;

      const element = render(
        <Suspense fallback={<span>Foo</span>}>
          <Provider for={foo} fallback={undefined}>
            <Consumer />
          </Provider>
        </Suspense>
      );

      expect(element.queryByText('Foo')).not.toBeNull();

      element.rerender(
        <Suspense fallback={<span>Foo</span>}>
          <Provider for={foo} fallback={<span>Bar</span>}>
            <Consumer />
          </Provider>
        </Suspense>
      );

      expect(element).toHaveText('Bar');
      expect(element).not.toHaveText('Foo');
    });
  });

  it('will create once, provide and destroy on unmount under strict mode', async () => {
    const didCreate = vi.fn();
    const didDestroy = vi.fn();

    class Test extends State {
      value = 'hello';

      protected new() {
        didCreate();
        return didDestroy;
      }
    }

    const Child = () => Test.get().value;

    const element = render(
      <React.StrictMode>
        <Provider for={Test}>
          <Child />
        </Provider>
      </React.StrictMode>
    );

    await flushMicrotasks();

    expect(element.container.textContent).toBe('hello');
    expect(didCreate).toBeCalledTimes(1);
    expect(didDestroy).not.toBeCalled();

    element.unmount();

    expect(didDestroy).toBeCalledTimes(1);
  });
});

describe('context', () => {
  it('will select closest instance and closest match', () => {
    within(
      () => expect(Foo.get().value).toBe('inner'),
      (check) => (
        <Provider for={Foo} value="outer">
          <Provider for={Foo} value="inner">
            {check}
          </Provider>
        </Provider>
      )
    );

    within(
      () => expect(Bar.get()).toBeInstanceOf(Baz),
      (check) => (
        <Provider for={Bar}>
          <Provider for={Baz}>{check}</Provider>
        </Provider>
      )
    );
  });

  it('will not select nested instance from outer sibling', () => {
    const Value = () => Foo.get().value;

    const element = render(
      <Provider for={Foo} value="outer">
        <Value />
        <Provider for={Foo} value="inner">
          <Value />
        </Provider>
        <Value />
      </Provider>
    );

    expect(element.container.textContent).toBe('outerinnerouter');
  });

  it('will not select nested instance from outer sibling on server', () => {
    const Value = () => Foo.get(({ value }) => value);

    const html = renderToString(
      <Provider for={Foo} value="outer">
        <Value />
        <Provider for={Foo} value="inner">
          <Value />
        </Provider>
        <Value />
      </Provider>
    );

    expect(html.replace(/<!--[^>]*-->/g, '')).toBe('outerinnerouter');
  });

  it('will return root context if called outside render', () => {
    expect(Context.get()).toBe(Context.root);
  });

  it('will handle complex arrangement', () => {
    const instance = Foo.new();

    within(
      () => {
        expect(Foo.get().is).toBe(instance);
        expect(Bar.get()).toBeInstanceOf(Bar);
        expect(Baz.get()).toBeInstanceOf(Baz);
      },
      (check) => (
        <Provider for={instance}>
          <Provider for={Baz}>
            <Provider for={{ Bar }}>{check}</Provider>
          </Provider>
        </Provider>
      )
    );
  });
});

describe('get instruction', () => {
  class Foo extends State {
    bar = get(Bar);
  }

  class Bar extends State {
    value = 'bar';
  }

  it('will attach where created by provider', () => {
    within(
      () => expect(Foo.get().bar).toBeInstanceOf(Bar),
      (check) => (
        <Provider for={Bar}>
          <Provider for={Foo}>{check}</Provider>
        </Provider>
      )
    );
  });

  it('will maintain hook', async () => {
    const Inner: React.FC = vi.fn(() => {
      Foo.use();
      return null;
    });

    const x = render(
      <Provider for={Bar}>
        <Inner />
      </Provider>
    );

    x.rerender(
      <Provider for={Bar}>
        <Inner />
      </Provider>
    );

    expect(Inner).toBeCalledTimes(2);
  });

  it('will attach before model init', () => {
    class Parent extends State {
      foo = 'foo';
    }

    class Child extends State {
      parent = get(Parent);

      protected new() {
        expect(this.parent).toBeInstanceOf(Parent);
      }
    }

    const is = vi.fn();

    render(
      <Provider for={Parent}>
        <Provider for={Child} is={is} />
      </Provider>
    );

    expect(is).toBeCalled();
  });

  it('will compute immediately in context', () => {
    class Foo extends State {
      value = 'foobar';
    }
    class Bar extends State {
      foo = get(Foo);
    }

    const FooBar = () => <>{Bar.use().foo.value}</>;

    render(
      <Provider for={Foo}>
        <FooBar />
      </Provider>
    );

    expect(screen).toHaveText('foobar');
  });
});

describe('has instruction', () => {
  it('will notify parent', () => {
    class Foo extends State {
      value = get(Bar, true, didGetBar);
    }

    class Bar extends State {
      foo = get(Foo);
    }

    const didGetBar = vi.fn();
    const FooBar = () => void Bar.use();
    const foo = new Foo();

    render(
      <Provider for={foo}>
        <FooBar />
        <FooBar />
      </Provider>
    );

    expect(didGetBar).toBeCalledTimes(2);
    expect(foo.value).toEqual([expect.any(Bar), expect.any(Bar)]);
    expect(foo.value.map((i) => i.foo)).toEqual([foo, foo]);
  });

  it.skip('will notify parent of instance', () => {
    class Foo extends State {
      value = get(Bar, true, didGetBar);
    }

    class Bar extends State {
      foo = get(Foo);
    }

    const didGetBar = vi.fn();
    const FooBar = () => void Bar.use();

    const Component = () => {
      const foo = Foo.use();

      return (
        <Provider for={foo}>
          <FooBar />
        </Provider>
      );
    };

    render(<Component />);
    expect(didGetBar).toBeCalled();
  });
});

describe('suspense', () => {
  it('will apply fallback and resolve', async () => {
    let resolve!: (value: string) => void;

    class Test extends State {
      value = set(() => new Promise<string>((res) => (resolve = res)));
    }

    const GetValue = () => {
      const { value } = Test.get();
      return <span>{value}</span>;
    };

    const TestComponent = () => (
      <Provider for={Test}>
        <Suspense fallback={<span>Loading...</span>}>
          <GetValue />
        </Suspense>
      </Provider>
    );

    render(<TestComponent />);

    expect(screen).toHaveText('Loading...');

    await act(async () => {
      resolve('hello!');
    });

    await screen.findByText('hello!');
  });
});

describe('HMR', () => {
  it('will remount context if item removed or replaced', () => {
    class Test extends State {
      value = 'foo';
    }

    let Control = class Control1 extends Test {
      value = 'bar';
    };

    const Child = () => <div>{Test.get().value}</div>;

    const element = render(
      <Provider for={Control}>
        <Child />
      </Provider>
    );

    expect(screen).toHaveText('bar');

    Control = class Control2 extends Test {
      value = 'baz';
    };

    element.rerender(
      <Provider for={Control}>
        <Child />
      </Provider>
    );

    expect(screen).toHaveText('baz');
  });

  it.todo("will updated consumer if context's instance is replaced", () => {});
});

describe('root global', () => {
  class Global extends State {
    static global = true;
    value = 'root';
  }

  it('will get from root unless provided', () => {
    const instance = Global.new();

    within(() => expect(Global.get().is).toBe(instance), (check) => check);

    within(
      () => {
        const global = Global.get();

        expect(global.is).not.toBe(instance);
        expect(global).toBeInstanceOf(Global);
      },
      (check) => <Provider for={Global}>{check}</Provider>
    );

    instance.set(null);
  });
});
