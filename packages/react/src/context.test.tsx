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
import { Component, State, Context, get, set } from '.';
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
        return <Component for={Foo} is={(foo) => (provided = foo)} />;
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
      (check) => <Component for={{ foo, Bar }}>{check}</Component>
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
        <Component for={Test} is={is} foo="hello" bar={42}>
          {check}
        </Component>
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

    render(<Component for={Config} is={is} _mode="dark" />);

    expect(is.mock.calls[0][0]._mode).toBe('dark');
  });

  it('will use the current is for a later registration', () => {
    class First extends State {}
    class Second extends State {}

    const seen: string[] = [];

    const element = render(
      <Component for={First} is={() => seen.push('first')}>
        <span />
      </Component>
    );

    element.rerender(
      <Component for={Second} is={() => seen.push('second')}>
        <span />
      </Component>
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
      <Component for={Test} is={capture} foo="hello">
        <span />
      </Component>
    );

    expect(seen[0].foo).toBe('hello');

    // the single instance is replaced by a map-registered one, which rest props
    // never apply to - the departed instance must not keep receiving them
    element.rerender(
      <Component for={{ Test }} is={capture} foo="ignored">
        <span />
      </Component>
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
      <Component for={Test} value="first">
        <Child />
      </Component>
    );

    expect(screen).toHaveText('first');

    act(() => {
      element.rerender(
        <Component for={Test} value="second">
          <Child />
        </Component>
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
        <Component for={test} value="hello">
          {check}
        </Component>
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
      <Component for={{ Foo, Bar, instance }}>
        <Check />
      </Component>
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
      <Component for={Parent}>
        <Component for={Child} />
      </Component>
    );

    element.unmount();

    expect(didDestroy.mock.calls).toEqual([['Child'], ['Parent']]);
  });

  describe('mount method', () => {
    it.each([false, true])('will call for an instance it creates (strict: %s)', (reactStrictMode) => {
      const didMount = vi.fn();
      const didUnmount = vi.fn();

      class Test extends State {
        mount() {
          didMount();
          return didUnmount;
        }
      }

      const element = render(
        <Component for={Test}>
          <span />
        </Component>,
        { reactStrictMode }
      );

      expect(didMount).toBeCalledTimes(1);
      expect(didUnmount).not.toBeCalled();

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
        <Component for={{ Owned, guest }}>
          <span />
        </Component>
      );

      expect(didMount.mock.calls).toEqual([['owned']]);

      element.unmount();

      expect(guest.get(null)).toBe(false);
    });

    it.each([
      // mount belongs to the Provider's own commit, so a `for` replaced
      // mid-life provides Second without ever mounting it
      ['will not mount a state swapped in by a later render', undefined, undefined, [['first']]],
      // a new key is a new Provider, so the swap mounts as any first commit does
      ['will mount a swapped state when the Provider is keyed', 'first', 'second', [['first'], ['second']]]
    ])('%s', (_, firstKey, secondKey, calls) => {
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
        <Component key={firstKey} for={First}>
          <span />
        </Component>
      );

      element.rerender(
        <Component key={secondKey} for={Second}>
          <span />
        </Component>
      );

      expect(didMount.mock.calls).toEqual(calls);
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
        <Component for={Outer}>
          <Child />
        </Component>
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

      const rendered = render(<Component for={{ Foo, Bar }} is={forEach} />);

      expect(forEach).toBeCalledTimes(2);
      expect(captured).toBeInstanceOf(State);

      expect(() => rendered.unmount()).not.toThrow();
    });

    it('will call for each model and cleanup through the state', () => {
      const cleanup = vi.fn();
      const forEach = vi.fn((state: State) => {
        state.set(null, cleanup);
      });

      const rendered = render(<Component for={{ Foo, Bar }} is={forEach} />);

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
        <Component for={foo} fallback={<span>Loading...</span>}>
          <Consumer />
        </Component>
      );

      expect(element).toHaveText('Loading...');

      await act(async () => {
        foo.value = 'Hello World';
      });

      expect(element).toHaveText('Hello World');
      expect(element).not.toHaveText('Loading...');
    });

    it('will ignore suspense if undefined', async () => {
      class Foo extends State {
        value = set<string>();
      }

      const foo = Foo.new();
      const Consumer = () => Foo.get().value;

      const element = render(
        <Suspense fallback={<span>Foo</span>}>
          <Component for={foo} fallback={undefined}>
            <Consumer />
          </Component>
        </Suspense>
      );

      expect(element).toHaveText('Foo');

      await act(async () => {
        foo.value = 'Hello World';
      });

      expect(element).toHaveText('Hello World');
      expect(element).not.toHaveText('Foo');
    });

    preactDiffers('will take over from outer suspense when fallback is set', () => {
      class Foo extends State {
        value = set<string>();
      }

      const foo = Foo.new();
      const Consumer = () => Foo.get().value;

      const element = render(
        <Suspense fallback={<span>Foo</span>}>
          <Component for={foo} fallback={undefined}>
            <Consumer />
          </Component>
        </Suspense>
      );

      expect(element.queryByText('Foo')).not.toBeNull();

      element.rerender(
        <Suspense fallback={<span>Foo</span>}>
          <Component for={foo} fallback={<span>Bar</span>}>
            <Consumer />
          </Component>
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
        <Component for={Test}>
          <Child />
        </Component>
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
        <Component for={Foo} value="outer">
          <Component for={Foo} value="inner">
            {check}
          </Component>
        </Component>
      )
    );

    within(
      () => expect(Bar.get()).toBeInstanceOf(Baz),
      (check) => (
        <Component for={Bar}>
          <Component for={Baz}>{check}</Component>
        </Component>
      )
    );
  });

  it('will not select nested instance from outer sibling', () => {
    const Value = () => Foo.get().value;

    const element = render(
      <Component for={Foo} value="outer">
        <Value />
        <Component for={Foo} value="inner">
          <Value />
        </Component>
        <Value />
      </Component>
    );

    expect(element.container.textContent).toBe('outerinnerouter');
  });

  it('will not select nested instance from outer sibling on server', () => {
    const Value = () => Foo.get(({ value }) => value);

    const html = renderToString(
      <Component for={Foo} value="outer">
        <Value />
        <Component for={Foo} value="inner">
          <Value />
        </Component>
        <Value />
      </Component>
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
        <Component for={instance}>
          <Component for={Baz}>
            <Component for={{ Bar }}>{check}</Component>
          </Component>
        </Component>
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
        <Component for={Bar}>
          <Component for={Foo}>{check}</Component>
        </Component>
      )
    );
  });

  it('will maintain hook', async () => {
    const Inner: React.FC = vi.fn(() => {
      Foo.use();
      return null;
    });

    const x = render(
      <Component for={Bar}>
        <Inner />
      </Component>
    );

    x.rerender(
      <Component for={Bar}>
        <Inner />
      </Component>
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
      <Component for={Parent}>
        <Component for={Child} is={is} />
      </Component>
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
      <Component for={Foo}>
        <FooBar />
      </Component>
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
      <Component for={foo}>
        <FooBar />
        <FooBar />
      </Component>
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
        <Component for={foo}>
          <FooBar />
        </Component>
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
      <Component for={Test}>
        <Suspense fallback={<span>Loading...</span>}>
          <GetValue />
        </Suspense>
      </Component>
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
      <Component for={Control}>
        <Child />
      </Component>
    );

    expect(screen).toHaveText('bar');

    Control = class Control2 extends Test {
      value = 'baz';
    };

    element.rerender(
      <Component for={Control}>
        <Child />
      </Component>
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
      (check) => <Component for={Global}>{check}</Component>
    );

    instance.set(null);
  });
});
