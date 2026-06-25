/** @jsxImportSource preact */
import { render, screen, act } from '@testing-library/preact';
import { mock, expect, it, describe } from 'bun:test';
import { ComponentChildren, createRef } from 'preact';
import { StrictMode } from 'preact/compat';

import { Component, Consumer, set } from '.';

it('will create and provide instance', () => {
  class Control extends Component {
    foo = 'bar';
  }

  render(
    <Control>
      <Consumer for={Control}>{(c) => c.foo}</Consumer>
    </Control>
  );

  expect(screen).toHaveText('bar');
});

it('will expose a base render for class detection', () => {
  // Preact detects class components via `prototype.render`. Core defines the
  // default (children passthrough) here; it is never invoked at runtime (the
  // per-instance render shadows it, and mvc's render chain excludes the seam)
  // but must exist as a function and fall back to null without children.
  const { render } = Component.prototype as { render(props?: {}): unknown };
  expect(typeof render).toBe('function');
  expect(render({})).toBe(null);
});

it('will not enumerate preact internals on instance', () => {
  class Control extends Component {
    foo = 'bar';
    baz = 123;
  }

  let instance!: Control;
  render(<Control is={(c) => (instance = c)} />);

  expect(Object.keys(instance).sort()).toEqual(['baz', 'foo']);
});

it('will create instance only once', () => {
  class Control extends Component {
    protected new() {
      didConstruct(this);
    }
  }

  const didConstruct = mock();
  const { rerender } = render(<Control />);

  expect(didConstruct).toBeCalled();

  rerender(<Control />);

  expect(didConstruct).toBeCalledTimes(1);
});

describe('ref prop', () => {
  it('will populate ref object with instance', () => {
    class Control extends Component {
      foo = 'bar';
    }

    const ref = createRef<Control>();
    const screen = render(<Control ref={ref} />);

    expect(ref.current).toBeInstanceOf(Control);
    expect(ref.current!.foo).toBe('bar');

    act(() => void screen.unmount());

    // Differs from React: preact core only resets object refs whose current
    // value is the host DOM node, so a class-instance ref is left populated
    // on unmount. Callback refs (next test) are nulled as in React.
    expect(ref.current).toBeInstanceOf(Control);
  });

  it('will invoke callback ref with instance', () => {
    class Control extends Component {}

    const cb = mock();
    const screen = render(<Control ref={cb} />);

    expect(cb).toBeCalled();
    expect(cb.mock.calls[0][0]).toBeInstanceOf(Control);

    act(() => void screen.unmount());
    expect(cb).toBeCalledTimes(2);
    expect(cb.mock.calls[1][0]).toBe(null);
  });
});

describe('new method', () => {
  it('will call if exists', () => {
    const didCreate = mock();

    class Test extends Component {
      protected new() {
        didCreate();
      }
    }

    const element = render(<Test />);

    expect(didCreate).toBeCalled();

    element.rerender(<Test />);

    expect(didCreate).toBeCalledTimes(1);
  });
});

describe('element props', () => {
  class Foo extends Component {
    /** Hover over this prop to see description. */
    value?: string = undefined;
  }

  it('will accept managed values', () => {
    render(
      <Foo value="baz">
        <Consumer for={Foo}>
          {(c) => {
            expect(c.value).toBe('baz');
          }}
        </Consumer>
      </Foo>
    );
  });

  it('will trigger set instruction', () => {
    class Foo extends Component {
      value = set('foobar', didSet);
    }

    const didSet = mock();

    render(<Foo value="barfoo" />);

    expect(didSet).toBeCalled();
  });

  it('will override method', async () => {
    class Test extends Component {
      callback() {
        return 'foo';
      }

      render() {
        return <span>{this.callback()}</span>;
      }
    }

    const element = render(<Test callback={() => 'bar'} />);
    expect(screen).toHaveText('bar');

    element.rerender(<Test callback={() => 'baz'} />);
    expect(screen).toHaveText('baz');
  });

  it('will not assign foreign values', () => {
    render(
      // @ts-expect-error
      <Foo nonValue="foobar">
        <Consumer for={Foo}>
          {(i) => {
            // @ts-expect-error
            expect(i.nonValue).toBeUndefined();
          }}
        </Consumer>
      </Foo>
    );
  });
});

describe('element children', () => {
  it('will handle multiple elements', () => {
    class Control extends Component {
      foo = 'bar';
    }

    const screen = render(
      <Control foo="sd">
        <span>Hello</span>
        <span>World</span>
      </Control>
    );

    expect(screen).toHaveText('Hello');
    expect(screen).toHaveText('World');
  });

  it('will notify parent', async () => {
    class Control extends Component {
      children = set<ComponentChildren>(undefined, didUpdate);
    }

    const didUpdate = mock();
    const screen = render(<Control>Hello</Control>);

    expect(screen).toHaveText('Hello');
    expect(didUpdate).toBeCalled();
  });

  it('will accept arbitrary children with render', () => {
    const symbol = Symbol('foo');

    class Control extends Component {
      render(props = {} as { children: symbol }) {
        expect(props.children).toBe(symbol);
        return 'Hello';
      }
    }

    const screen = render(<Control>{symbol}</Control>);

    expect(screen).toHaveText('Hello');
  });
});

describe('props property', () => {
  it('will update on rerender', () => {
    class Control extends Component {
      render(props = {} as { value: string }) {
        return <>{props.value}</>;
      }
    }

    const { rerender } = render(<Control value="foo" />);
    expect(screen).toHaveText('foo');

    rerender(<Control value="bar" />);
    expect(screen).toHaveText('bar');
  });

  it('will be observable', async () => {
    const didUpdate = mock();

    class Control extends Component {
      protected new() {
        this.get(({ props }, keys) => {
          didUpdate(props);
        });
      }

      render(props = {} as { value: string }) {
        return <>{props.value}</>;
      }
    }

    const { rerender } = render(<Control value="foo" />);

    expect(didUpdate).toBeCalledWith({ value: 'foo' });

    await act(async () => {
      rerender(<Control value="bar" />);
    });

    expect(didUpdate).toBeCalledWith({ value: 'bar' });
    expect(didUpdate).toBeCalledTimes(2);
  });

  it('will not cause redundant render', async () => {
    const didRender = mock();
    let control: Control;

    class Control extends Component {
      new() {
        control = this;
      }

      render(props = {} as { value: string }) {
        didRender();
        return <>{props.value}</>;
      }
    }

    const { rerender } = render(<Control value="foo" />);

    expect(didRender).toBeCalledTimes(1);

    rerender(<Control value="bar" />);

    await expect(control!).toHaveUpdated();

    // Differs from React (2 renders): preact flushes the subscription
    // refresh from the props merge on a microtask, so one parent-driven
    // render plus one subscription render land before this assertion -
    // React defers the latter past it via its scheduler.
    expect(didRender.mock.calls.length).toBeLessThanOrEqual(3);

    // ensure renders settle - no continued churn
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const settled = didRender.mock.calls.length;

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(didRender.mock.calls.length).toBe(settled);
  });
});

describe('render method', () => {
  it('will be element output', () => {
    class Control extends Component {
      foo = 'bar';

      render(props = {} as { bar: string }) {
        return (
          <>
            <span>{props.bar}</span>
            <span>{this.foo}</span>
          </>
        );
      }
    }

    const screen = render(<Control bar="foo" />);

    expect(screen).toHaveText('foo');
    expect(screen).toHaveText('bar');
  });

  it('will accept function component', async () => {
    function FunctionComponent(
      this: ClassComponent,
      props = {} as { name: string }
    ) {
      return (
        <div>
          {this.salutation} {props.name}
        </div>
      );
    }

    class ClassComponent extends Component {
      salutation = 'Hello';
      render = FunctionComponent;
    }

    const screen = render(<ClassComponent name="World" />);

    expect(screen).toHaveText('Hello World');

    screen.rerender(<ClassComponent salutation="Bonjour" name="Preact" />);

    expect(screen).toHaveText('Bonjour Preact');
  });

  it('will handle children if managed by this', () => {
    class Control extends Component {
      children = set<ComponentChildren>();

      render(props = {} as { value: string }) {
        return (
          <>
            <span>{props.value}</span>
            {this.children}
          </>
        );
      }
    }

    const screen = render(<Control value="Hello">World</Control>);

    expect(screen).toHaveText('Hello');
    expect(screen).toHaveText('World');
  });

  it('will refresh on update', async () => {
    class Control extends Component {
      value = 'bar';

      render() {
        return <span>{this.value}</span>;
      }
    }

    let control: Control;
    const screen = render(<Control is={(x) => (control = x)} />);

    expect(screen).toHaveText('bar');

    await act(async () => {
      control.value = 'foo';
      await control.set();
    });

    expect(screen).toHaveText('foo');
  });
});

describe('suspense', () => {
  it('will render fallback property', async () => {
    class Foo extends Component {
      fallback = (<span>Loading...</span>);
      value = set<string>();
    }

    let foo!: Foo;
    const Consumer = () => <>{(foo = Foo.get()).value}</>;

    const element = render(
      <Foo>
        <Consumer />
      </Foo>
    );

    expect(element).toHaveText('Loading...');

    await act(async () => void (foo.value = 'Hello World'));

    expect(element).toHaveText('Hello World');
  });

  it('will fallback when own render suspends', async () => {
    class Foo extends Component {
      value = set<string>();
      fallback = (<span>Loading!</span>);
      render() {
        return <>{this.value}</>;
      }
    }

    let foo!: Foo;

    const element = render(<Foo is={(x) => (foo = x)} />);

    expect(element).toHaveText('Loading!');

    await act(async () => {
      foo.value = 'Hello World';
    });

    expect(element).toHaveText('Hello World');
  });

  it('will use fallback property first', async () => {
    class Foo extends Component {
      value = set<string>();
      fallback = (<span>Loading!</span>);
    }

    let foo!: Foo;
    const Consumer = () => <>{Foo.get().value}</>;

    const element = render(
      <Foo is={(x) => (foo = x)}>
        <Consumer />
      </Foo>
    );

    expect(element).toHaveText('Loading!');

    element.rerender(
      <Foo fallback={<span>Loading...</span>}>
        <Consumer />
      </Foo>
    );

    expect(element).toHaveText('Loading...');

    await act(async () => {
      foo.value = 'Hello World';
    });

    expect(element).toHaveText('Hello World');
  });

  it('will update with new fallback', async () => {
    class Foo extends Component {
      value = set<string>();
      fallback = (<span>Loading!</span>);
    }

    let foo!: Foo;
    const Consumer = () => <>{Foo.get().value}</>;

    const element = render(
      <Foo is={(x) => (foo = x)}>
        <Consumer />
      </Foo>
    );

    expect(element).toHaveText('Loading!');

    await act(async () => {
      foo.fallback = <span>Loading...</span>;
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(element).toHaveText('Loading...');

    await act(async () => {
      foo.value = 'Hello World';
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(element).toHaveText('Hello World');
  });
});

describe('unmount', () => {
  it('will dispose instance', () => {
    const didDispose = mock();

    class Control extends Component {
      protected new() {
        return didDispose;
      }
    }

    const element = render(<Control />);

    expect(didDispose).not.toBeCalled();

    element.unmount();

    expect(didDispose).toBeCalled();
  });
});

describe('state props on rerender', () => {
  it('will update instance value', () => {
    class Control extends Component {
      value = 'initial';

      render() {
        return <span>{this.value}</span>;
      }
    }

    const element = render(<Control value="first" />);

    expect(screen).toHaveText('first');

    element.rerender(<Control value="second" />);

    expect(screen).toHaveText('second');
  });

  it('will clear omitted instance value', () => {
    class Control extends Component {
      value?: string = 'initial';

      render() {
        return <span>{this.value || 'empty'}</span>;
      }
    }

    const element = render(<Control value="first" />);

    expect(screen).toHaveText('first');

    element.rerender(<Control />);

    expect(screen).toHaveText('empty');
  });
});

describe('default render', () => {
  it('will pass children through', () => {
    class Control extends Component {}

    render(
      <Control>
        <span>Hello World</span>
      </Control>
    );

    expect(screen).toHaveText('Hello World');
  });

  it('will provide instance created', () => {
    class Parent extends Component {
      value = 'foobar';
    }
    const Child = () => <>{Parent.get().value}</>;

    const element = render(
      <Parent>
        <Child />
      </Parent>
    );

    expect(element).toHaveText('foobar');
  });
});

describe('render chain', () => {
  it('will compose subclass render as children of super', () => {
    class Outer extends Component {
      render(props = {} as { children?: ComponentChildren }) {
        return (
          <main>
            <h1>Wrapper</h1>
            {props.children}
          </main>
        );
      }
    }

    class Inner extends Outer {
      render() {
        return <span>Content</span>;
      }
    }

    const element = render(<Inner />);

    // Inner authors content via render; Outer orchestration still wraps it,
    // without Inner calling super.render().
    const heading = element.getByText('Wrapper');
    const content = element.getByText('Content');

    expect(heading.tagName).toBe('H1');
    expect(content.closest('main')).toBe(heading.closest('main'));
  });

  it('will stay reactive across composed levels', async () => {
    class Frame extends Component {
      title = 'Base';

      render(props = {} as { children?: ComponentChildren }) {
        return (
          <article>
            <h2>{this.title}</h2>
            {props.children}
          </article>
        );
      }
    }

    class Page extends Frame {
      body = 'Hello';

      render() {
        return <p>{this.body}</p>;
      }
    }

    let instance!: Page;
    render(<Page is={(x) => (instance = x)} />);

    expect(screen).toHaveText('Base');
    expect(screen).toHaveText('Hello');

    // Both the super's and the subclass's reactive reads drive updates.
    await act(async () => {
      instance.title = 'Updated';
      instance.body = 'World';
    });

    expect(screen).toHaveText('Updated');
    expect(screen).toHaveText('World');
  });

  it('will drop derived content if wrapper omits children', () => {
    // Documented footgun: an intermediate render is a wrapper - if it does not
    // place props.children, the derived (subclass) content vanishes.
    class Shell extends Component {
      render() {
        return <div>Shell only</div>;
      }
    }

    class Lost extends Shell {
      render() {
        return <span>Never seen</span>;
      }
    }

    const element = render(<Lost />);

    expect(element).toHaveText('Shell only');
    expect(element).not.toHaveText('Never seen');
  });

});

describe('subcomponents', () => {
  it('will wrap PascalCase method as reactive component', async () => {
    class Dashboard extends Component {
      label = 'Hello';

      Sidebar() {
        return <span>{this.label}</span>;
      }

      render() {
        return <this.Sidebar />;
      }
    }

    let instance!: Dashboard;
    render(<Dashboard is={(x) => (instance = x)} />);

    expect(screen).toHaveText('Hello');

    await act(async () => {
      instance.label = 'Updated';
    });

    expect(screen).toHaveText('Updated');
  });

  it('will be accessible via context get', () => {
    class Dashboard extends Component {
      Sidebar() {
        return <span>Sidebar Content</span>;
      }

      render() {
        return <>{this.props.children}</>;
      }
    }

    const Child = () => {
      const { Sidebar } = Dashboard.get();
      return <Sidebar />;
    };

    render(
      <Dashboard>
        <Child />
      </Dashboard>
    );

    expect(screen).toHaveText('Sidebar Content');
  });

  it('will allow override via setter', async () => {
    class Dashboard extends Component {
      value = 'Original';

      Sidebar() {
        return <span>{this.value}</span>;
      }

      render() {
        return <this.Sidebar />;
      }
    }

    let instance!: Dashboard;
    render(<Dashboard is={(x) => (instance = x)} />);

    expect(screen).toHaveText('Original');

    await act(async () => {
      instance.Sidebar = function (this: Dashboard) {
        return <span>Replaced: {this.value}</span>;
      } as any;
      instance.value = 'yes';
    });

    expect(screen).toHaveText('Replaced: yes');
  });

  it('will accept props', () => {
    class Dashboard extends Component {
      Sidebar(props: { label: string }) {
        return <span>{props.label}</span>;
      }

      render() {
        return <this.Sidebar label="Dynamic Label" />;
      }
    }

    render(<Dashboard />);

    expect(screen).toHaveText('Dynamic Label');
  });

  it('will work in strict mode', async () => {
    class Dashboard extends Component {
      label = 'Hello';

      Sidebar() {
        return <span>{this.label}</span>;
      }

      render() {
        return <this.Sidebar />;
      }
    }

    let instance!: Dashboard;
    const element = render(
      <StrictMode>
        <Dashboard is={(x) => (instance = x)} />
      </StrictMode>
    );

    await new Promise((r) => setTimeout(r, 0));

    expect(screen).toHaveText('Hello');

    await act(async () => {
      instance.label = 'Updated';
    });

    expect(screen).toHaveText('Updated');

    element.unmount();
  });

  it('will render usages independently', async () => {
    const renders = { a: 0, b: 0 };

    class Dashboard extends Component {
      label = 'Hello';

      Sidebar(props: { id: 'a' | 'b' }) {
        renders[props.id]++;
        return (
          <span>
            {props.id}: {this.label}
          </span>
        );
      }

      render() {
        return (
          <>
            <this.Sidebar id="a" />
            <this.Sidebar id="b" />
          </>
        );
      }
    }

    let instance!: Dashboard;
    render(<Dashboard is={(x) => (instance = x)} />);

    expect(screen).toHaveText('a: Hello');
    expect(screen).toHaveText('b: Hello');

    await act(async () => {
      instance.label = 'World';
    });

    expect(screen).toHaveText('a: World');
    expect(screen).toHaveText('b: World');
    expect(renders.a).toBeGreaterThan(1);
    expect(renders.b).toBeGreaterThan(1);
  });

  it('will refresh independently based on subscriptions', async () => {
    const renders = { a: 0, b: 0 };

    class Dashboard extends Component {
      x = 'x';
      y = 'y';

      Display(props: { which: 'a' | 'b' }) {
        renders[props.which]++;
        return <span>{props.which === 'a' ? this.x : this.y}</span>;
      }

      render() {
        return (
          <>
            <this.Display which="a" />
            <this.Display which="b" />
          </>
        );
      }
    }

    let instance!: Dashboard;
    render(<Dashboard is={(x) => (instance = x)} />);

    expect(screen).toHaveText('x');
    expect(screen).toHaveText('y');

    const before = { ...renders };

    await act(async () => {
      instance.x = 'x2';
    });

    expect(screen).toHaveText('x2');
    expect(screen).toHaveText('y');

    // only the "a" instance should have re-rendered
    expect(renders.a).toBe(before.a + 1);
    expect(renders.b).toBe(before.b);
  });
});

describe('strict mode', () => {
  // Note: preact's StrictMode is an alias of Fragment - components are
  // constructed and mounted exactly once, so the React-specific
  // double-invocation behaviors (construct twice, init once) do not exist.
  it('will not create two instances', async () => {
    const didCreate = mock();
    const didDestroy = mock();

    class Control extends Component {
      foo = 'bar';

      new() {
        didCreate();
        return didDestroy;
      }
    }

    const element = render(
      <StrictMode>
        <Control />
      </StrictMode>
    );

    await new Promise((r) => setTimeout(r, 0));

    expect(didCreate).toBeCalledTimes(1);
    expect(didDestroy).not.toBeCalled();

    element.unmount();

    expect(didDestroy).toBeCalledTimes(1);
  });

  it('will refresh via property update', async () => {
    const didRender = mock();
    let instance!: Control;

    class Control extends Component {
      foo = 'bar';

      new() {
        instance = this;
      }

      render() {
        didRender(this.foo);
        return <span>{this.foo}</span>;
      }
    }

    const element = render(
      <StrictMode>
        <Control />
      </StrictMode>
    );

    await new Promise((r) => setTimeout(r, 0));

    expect(screen).toHaveText('bar');

    await act(async () => {
      instance.foo = 'baz';
    });

    expect(screen).toHaveText('baz');
    expect(didRender).toBeCalledWith('baz');

    await act(async () => {
      instance.foo = 'qux';
    });

    expect(screen).toHaveText('qux');
    expect(didRender).toBeCalledWith('qux');

    element.unmount();
  });

  it('will refresh via props update', async () => {
    const didRender = mock();

    class Control extends Component {
      foo = 'bar';

      render() {
        didRender(this.foo);
        return <span>{this.foo}</span>;
      }
    }

    const { rerender } = render(
      <StrictMode>
        <Control />
      </StrictMode>
    );

    await new Promise((r) => setTimeout(r, 0));

    expect(screen).toHaveText('bar');
    didRender.mockClear();

    rerender(
      <StrictMode>
        <Control foo="baz" />
      </StrictMode>
    );

    await new Promise((r) => setTimeout(r, 0));

    expect(screen).toHaveText('baz');
    expect(didRender).toBeCalledWith('baz');
  });

  it('will construct then init once', async () => {
    const order: string[] = [];

    class Control extends Component {
      constructor(props: any, ...rest: any[]) {
        super(props, ...rest);
        order.push('construct');
      }
    }

    Control.on(() => {
      order.push('init');
    });

    const element = render(
      <StrictMode>
        <Control />
      </StrictMode>
    );

    await new Promise((r) => setTimeout(r, 0));

    expect(order).toEqual(['construct', 'init']);

    element.unmount();
  });
});
