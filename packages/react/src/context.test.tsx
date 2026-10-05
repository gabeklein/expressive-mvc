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
import { flushMicrotasks } from '../test.setup';

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

  it('will create instance of given model', () => {
    function Check() {
      expect(Foo.get()).toBeInstanceOf(Foo);
      return null;
    }

    render(
      <Provider for={Foo}>
        <Check />
      </Provider>
    );
  });

  it('will create all models in given object', () => {
    function Check() {
      expect(Foo.get()).toBeInstanceOf(Foo);
      expect(Bar.get()).toBeInstanceOf(Bar);
      return null;
    }

    render(
      <Provider for={{ Foo, Bar }}>
        <Check />
      </Provider>
    );
  });

  it('will provide a mix of state and models', () => {
    const foo = Foo.new();

    function Check() {
      expect(Foo.get().is).toBe(foo);
      expect(Bar.get()).toBeInstanceOf(Bar);
      return null;
    }

    render(
      <Provider for={{ foo, Bar }}>
        <Check />
      </Provider>
    );
  });

  it('will pass props to created instance', () => {
    class Test extends State {
      foo = 'default';
      bar = 0;
    }

    function Check() {
      const { foo, bar } = Test.get();

      expect(foo).toBe('hello');
      expect(bar).toBe(42);
      return null;
    }

    render(
      <Provider for={Test} foo="hello" bar={42}>
        <Check />
      </Provider>
    );
  });

  it('will call is callback with created instance', () => {
    class Test extends State {
      value = 'hello';
    }

    const is = vi.fn();

    function Check() {
      expect(Test.get()).toBeInstanceOf(Test);
      return null;
    }

    render(
      <Provider for={Test} is={is}>
        <Check />
      </Provider>
    );

    expect(is).toBeCalledTimes(1);
    expect(is).toBeCalledWith(expect.any(Test));
  });

  it('will apply rest props alongside is', () => {
    const is = vi.fn();

    function Check() {
      expect(Foo.get().value).toBe('hello');
      return null;
    }

    render(
      <Provider for={Foo} is={is} value="hello">
        <Check />
      </Provider>
    );

    expect(is).toBeCalledTimes(1);
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

  it('will ignore rest props on multi-form for', () => {
    class Test extends State {
      foo = 'default';
    }

    function Check() {
      expect(Test.get().foo).toBe('default');
      return null;
    }

    render(
      <Provider for={{ Test }} foo="hello">
        <Check />
      </Provider>
    );
  });

  it('will update instance when props change', async () => {
    class Test extends State {
      value = 'initial';
    }

    const Child = vi.fn(() => {
      const { value } = Test.get();
      return <span>{value}</span>;
    });

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

    function Check() {
      const { is } = Foo.get();

      expect(is).toBe(test);
      expect(is.value).toBe('hello');
      return null;
    }

    render(
      <Provider for={test} value="hello">
        <Check />
      </Provider>
    );
  });

  it('will provide children of given model', () => {
    class Foo extends State {
      value?: string = undefined;
    }
    class Bar extends State {
      foo = new Foo();
    }

    function Check() {
      expect(Foo.get()).toBeInstanceOf(Foo);
      return null;
    }

    render(
      <Provider for={Bar}>
        <Check />
      </Provider>
    );
  });

  it('will resolve siblings regardless of declaration order', () => {
    const didRender = vi.fn();

    class Peer extends State {}
    class Child extends State {
      peer = get(Peer);
    }
    class Parent extends State {
      child = new Child();
      peer = new Peer();
    }

    function Check() {
      const { child, peer } = Parent.get();

      didRender(child.peer.is, peer.is);
      return null;
    }

    render(
      <Provider for={Parent}>
        <Check />
      </Provider>
    );

    expect(didRender).toBeCalledTimes(1);

    const [peer, sibling] = didRender.mock.calls[0];

    expect(peer).toBeInstanceOf(Peer);
    expect(peer).toBe(sibling);
  });

  it('will destroy created model on unmount', async () => {
    const willDestroy = vi.fn();

    class Test extends State {}

    function Check() {
      const test = Test.get();

      expect(test).toBeInstanceOf(Test);
      test.get(() => willDestroy);
      return null;
    }

    const element = render(
      <Provider for={{ Test }}>
        <Check />
      </Provider>
    );

    element.unmount();
    expect(willDestroy).toBeCalled();
  });

  it('will destroy multiple created on unmount', async () => {
    const willDestroy = vi.fn();

    class Foo extends State {}
    class Bar extends State {}

    function Check() {
      Foo.get().get(() => willDestroy);
      Bar.get().get(() => willDestroy);
      return null;
    }

    const element = render(
      <Provider for={{ Foo, Bar }}>
        <Check />
      </Provider>
    );

    element.unmount();
    expect(willDestroy).toBeCalledTimes(2);
  });

  it('will not destroy given instance on unmount', async () => {
    const didUnmount = vi.fn();

    class Test extends State {}

    const instance = Test.new();

    function Check() {
      Test.get().get(() => didUnmount);
      return null;
    }

    const element = render(
      <Provider for={{ instance }}>
        <Check />
      </Provider>
    );

    act(() => element.unmount());
    expect(didUnmount).not.toBeCalled();
  });

  it('will conflict colliding State types', () => {
    const foo = Foo.new();

    const Consumer: React.FC = vi.fn(() => {
      expect(() => Foo.get()).toThrow(
        'Did find Foo in context, but multiple were defined.'
      );
      return null;
    });

    render(
      <Provider for={{ Foo, foo }}>
        <Consumer />
      </Provider>
    );

    expect(Consumer).toBeCalled();
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

    const Example = () => (
      <Provider for={Parent}>
        <Provider for={Child} />
      </Provider>
    );

    const element = render(<Example />);

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

    it('will not call for an instance it is given', () => {
      const didMount = vi.fn();

      class Test extends State {
        mount() {
          didMount();
        }
      }

      const instance = Test.new();
      const element = render(
        <Provider for={instance}>
          <span />
        </Provider>
      );

      expect(didMount).not.toBeCalled();

      element.unmount();

      expect(instance.get(null)).toBe(false);
    });

    it('will distinguish created from given per key', () => {
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

      render(
        <Provider for={{ Owned, guest }}>
          <span />
        </Provider>
      );

      expect(didMount).toBeCalledTimes(1);
      expect(didMount).toBeCalledWith('owned');
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
    it('will call function for each model', () => {
      const forEach = vi.fn();

      render(<Provider for={{ Foo, Bar }} is={forEach} />);

      expect(forEach).toBeCalledTimes(2);
      expect(forEach).toBeCalledWith(expect.any(Foo));
      expect(forEach).toBeCalledWith(expect.any(Bar));
    });

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

    it('will cleanup on unmount through the state', () => {
      const cleanup = vi.fn();
      const forEach = vi.fn((state: State) => {
        state.set(null, cleanup);
      });

      const rendered = render(<Provider for={{ Foo, Bar }} is={forEach} />);

      expect(forEach).toBeCalledTimes(2);
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

    it('will ignore suspense if undefined', () => {
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

      element.queryByText('Foo');

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

  describe('strict mode', () => {
    it('will create once and destroy on unmount', async () => {
      const didCreate = vi.fn();
      const didDestroy = vi.fn();

      class Test extends State {
        protected new() {
          didCreate();
          return didDestroy;
        }
      }

      const element = render(
        <React.StrictMode>
          <Provider for={Test} />
        </React.StrictMode>
      );

      await flushMicrotasks();

      expect(didCreate).toBeCalledTimes(1);
      expect(didDestroy).not.toBeCalled();

      element.unmount();

      expect(didDestroy).toBeCalledTimes(1);
    });

    it('will provide instance to children', async () => {
      class Test extends State {
        value = 'hello';
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

      element.unmount();
    });
  });
});

describe('context', () => {
  it('will select extended class', () => {
    function Check() {
      expect(Bar.get()).toBeInstanceOf(Baz);
      return null;
    }

    render(
      <Provider for={Baz}>
        <Check />
      </Provider>
    );
  });

  it('will select closest instance of same type', () => {
    function Check() {
      expect(Foo.get().value).toBe('inner');
      return null;
    }

    render(
      <Provider for={Foo} value="outer">
        <Provider for={Foo} value="inner">
          <Check />
        </Provider>
      </Provider>
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

  it('will select closest match over best match', () => {
    function Check() {
      expect(Bar.get()).toBeInstanceOf(Baz);
      return null;
    }

    render(
      <Provider for={Bar}>
        <Provider for={Baz}>
          <Check />
        </Provider>
      </Provider>
    );
  });

  it('will return root context inside a render', () => {
    let ambient: Context | undefined;

    function Check() {
      ambient = Context.get();
      return null;
    }

    render(
      <Provider for={Foo}>
        <Check />
      </Provider>
    );

    expect(ambient).toBe(Context.root);
  });

  it('will render under the ambient context', () => {
    const base = Context.get;
    const ambient = new Context({ Foo: Foo.new({ value: 'ambient' }) });

    class View extends Component {
      foo = get(Foo);

      render() {
        return <>{this.foo.value}</>;
      }
    }

    Context.get = (state) => (state ? base(state) : ambient);

    try {
      expect(renderToString(<View />).replace(/<!--[^>]*-->/g, '')).toBe('ambient');
    } finally {
      Context.get = base;
      ambient.pop();
    }
  });

  it('will return root context if called outside render', () => {
    expect(Context.get()).toBe(Context.root);
  });

  it('will handle complex arrangement', () => {
    const instance = Foo.new();

    function Check() {
      expect(Foo.get().is).toBe(instance);
      expect(Bar.get()).toBeInstanceOf(Bar);
      expect(Baz.get()).toBeInstanceOf(Baz);
      return null;
    }

    render(
      <Provider for={instance}>
        <Provider for={Baz}>
          <Provider for={{ Bar }}>
            <Check />
          </Provider>
        </Provider>
      </Provider>
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
    function Check() {
      expect(Foo.get().bar).toBeInstanceOf(Bar);
      return null;
    }

    render(
      <Provider for={Bar}>
        <Provider for={Foo}>
          <Check />
        </Provider>
      </Provider>
    );
  });

  it('will see peers sharing same provider', () => {
    class Foo extends State {
      bar = get(Bar);
    }
    class Bar extends State {
      foo = get(Foo);
    }

    function Check() {
      const bar = Bar.get().is;
      const foo = Foo.get().is;

      expect(bar.foo.bar).toBe(bar);
      expect(foo.bar.foo).toBe(foo);
      return null;
    }

    render(
      <Provider for={{ Foo, Bar }}>
        <Check />
      </Provider>
    );
  });

  it('will see multiple peers provided', async () => {
    class Foo extends State {}
    class Baz extends State {
      bar = get(Bar);
      foo = get(Foo);
    }

    const Inner = () => {
      const { bar, foo } = Baz.use();

      expect(bar).toBeInstanceOf(Bar);
      expect(foo).toBeInstanceOf(Foo);

      return null;
    };

    render(
      <Provider for={{ Foo, Bar }}>
        <Inner />
      </Provider>
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

    render(
      <Provider for={Parent}>
        <Provider for={Child} />
      </Provider>
    );
  });

  it('will not resolve as own parent', () => {
    class MaybeSelf extends State {
      parent = get(MaybeSelf, false);
    }

    const test = MaybeSelf.new();

    render(<Provider for={test} />);

    expect(test.parent).not.toBe(test);
    expect(test.parent).toBeUndefined();
  });

  it('will compute immediately in context', () => {
    class Foo extends State {
      value = 'foobar';
    }
    class Bar extends State {
      foo = get(Foo);
    }

    const FooBar = () => {
      return <>{Bar.use().foo.value}</>;
    };

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

    const Child = () => {
      const { value } = Test.get();
      return <div>{value}</div>;
    };

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

    element.unmount();
  });

  it.todo("will updated consumer if context's instance is replaced", () => {});
});

describe('root global', () => {
  class Global extends State {
    static global = true;
    value = 'root';
  }

  it('will get from root if not found in context', () => {
    const instance = Global.new();

    function Check() {
      expect(Global.get().is).toBe(instance);
      return null;
    }

    render(<Check />);

    instance.set(null);
  });

  it('will prefer Provider instance over root global', () => {
    const instance = Global.new();

    function Check() {
      const global = Global.get();

      expect(global.is).not.toBe(instance);
      expect(global).toBeInstanceOf(Global);
      return null;
    }

    render(
      <Provider for={Global}>
        <Check />
      </Provider>
    );

    instance.set(null);
  });
});
