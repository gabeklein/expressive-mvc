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

describe('Component for', () => {
  it('will apply unmanaged _ props alongside is', () => {
    class Config extends State {
      _mode = 'light';
    }

    const is = vi.fn<(instance: Config) => void>();

    render(<Component for={Config} is={is} _mode="dark" />);

    expect(is.mock.calls[0][0]._mode).toBe('dark');
  });

  it('will release the previous class and pass the next to the current is', () => {
    class First extends State {}
    class Second extends State {}

    const seen: State[] = [];

    const element = render(
      <Component for={First} is={(first) => seen.push(first)}>
        <span />
      </Component>
    );

    element.rerender(
      <Component for={Second} is={(second) => seen.push(second)}>
        <span />
      </Component>
    );

    expect(seen).toEqual([expect.any(First), expect.any(Second)]);
    expect(seen[0].get(null)).toBe(true);
    expect(seen[1].get(null)).toBe(false);
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

      class Guest extends State {
        mount() {
          didMount();
        }
      }

      const guest = Guest.new();
      const element = render(
        <Component for={guest}>
          <span />
        </Component>
      );

      expect(didMount).not.toBeCalled();

      element.unmount();

      expect(guest.get(null)).toBe(false);
    });

    it('will hand the mount to a replacement class', () => {
      const events: string[] = [];

      class First extends State {
        mount() {
          events.push('mount first');
          return () => events.push('release first');
        }
      }

      class Second extends State {
        mount() {
          events.push('mount second');
          return () => events.push('release second');
        }
      }

      const element = render(
        <Component for={First}>
          <span />
        </Component>
      );

      element.rerender(
        <Component for={Second}>
          <span />
        </Component>
      );

      expect(events).toEqual(['mount first', 'release first', 'mount second']);

      element.unmount();

      expect(events).toEqual([
        'mount first',
        'release first',
        'mount second',
        'release second'
      ]);
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

    preactDiffers('will take over from outer suspense when fallback is set', () => {
      class Foo extends State {
        value = set<string>();
      }

      const foo = Foo.new();
      const Consumer = () => Foo.get().value;

      const element = render(
        <Suspense fallback={<span>Foo</span>}>
          <Component for={foo}>
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
            <Component for={Bar}>{check}</Component>
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

  it('will attach where provided by Component', () => {
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

    const Parent = () => {
      const foo = Foo.use();

      return (
        <Component for={foo}>
          <FooBar />
        </Component>
      );
    };

    render(<Parent />);
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
