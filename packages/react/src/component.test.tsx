import { render, screen, act, waitFor } from '@testing-library/react';
import { vi, expect, it, describe } from 'vitest';
import { renderToString } from 'react-dom/server';
import React, { Suspense } from 'react';

import { mockError, mockPromise, mockWarn, flushMicrotasks, revisions, preactDiffers, reactOnly } from '../test.setup';
import * as hot from '@expressive/mvc/hot';
import { Component, State, pending, set } from '.';

it('will create and provide instance', () => {
  class Control extends Component {
    foo = 'bar';
  }

  const Value = () => Control.get().foo;

  render(
    <Control>
      <Value />
    </Control>
  );

  expect(screen).toHaveText('bar');
});

it('will not enumerate react internals on instance', () => {
  class Control extends Component {
    foo = 'bar';
    baz = 123;
  }

  let instance!: Control;
  render(<Control is={(c) => (instance = c)} />);

  expect(Object.keys(instance).sort()).toEqual(['baz', 'foo']);
});

reactOnly.it('will transition Component dispatch', async () => {
  const gate = mockPromise<void>();

  class Control extends Component {
    value = 'a';

    render() {
      if (this.value === 'b') throw gate;
      return <span>{this.value}</span>;
    }
  }

  let instance!: Control;
  let setLocal!: React.Dispatch<React.SetStateAction<string>>;

  function View() {
    const [local, update] = React.useState('a');
    setLocal = update;

    return <>{local}<Control is={(current) => void (instance = current)} /></>;
  }

  const view = render(
    <Suspense fallback={<i>loading</i>}>
      <View />
    </Suspense>
  );

  await act(async () => {
    pending(() => {
      setLocal('b');
      instance.value = 'b';
    });
    await Promise.resolve();
  });

  // Local state updates urgently - pending() scopes to mvc-driven updates - while
  // the Component holds its own content rather than suspending to fallback.
  expect(view.container.querySelector('i')).toBeNull();
  expect(view.container.textContent).toBe('ba');

  instance.value = 'c';
  gate.resolve();
  await act(async () => {});

  expect(view.container.textContent).toBe('bc');
});

reactOnly.it('will not commit mixed revisions across repeated placement', async () => {
  const { commits, slow, reveal } = revisions(() => (instance.revision = 2));

  class Control extends Component {
    revision = 1;

    render() {
      const { revision } = this;

      slow();

      return <span>{revision}</span>;
    }
  }

  const instance = Control.new();
  const view = reveal(Array.from({ length: 40 }, (_, index) => <div key={index}>{instance}</div>));

  await waitFor(() => {
    expect(view.container.querySelectorAll('span')).toHaveLength(40);
  });

  expect(new Set(commits[0]).size).toBe(1);
});

describe('ref prop', () => {
  preactDiffers('will populate ref object with instance', () => {
    class Control extends Component {
      foo = 'bar';
    }

    const ref = React.createRef<Control>();
    const screen = render(<Control ref={ref} />);

    expect(ref.current).toBeInstanceOf(Control);
    expect(ref.current!.foo).toBe('bar');

    act(screen.unmount);
    expect(ref.current).toBe(null);
  });

  it('will invoke callback ref with instance', () => {
    class Control extends Component {}

    const cb = vi.fn();
    const screen = render(<Control ref={cb} />);

    expect(cb).toBeCalled();
    expect(cb.mock.calls[0][0]).toBeInstanceOf(Control);

    act(screen.unmount);
    expect(cb).toBeCalledTimes(2);
    expect(cb.mock.calls[1][0]).toBe(null);
  });
});

describe('new method', () => {
  it('will call new and is once', () => {
    const didCreate = vi.fn();
    const is = vi.fn();

    class Test extends Component {
      protected new() {
        didCreate();
      }
    }

    const element = render(<Test is={is} />);

    element.rerender(<Test is={is} />);

    expect(didCreate).toBeCalledTimes(1);
    expect(is).toBeCalledTimes(1);
  });
});

describe('mount method', () => {
  it.each([false, true])('will call once on commit and cleanup on unmount (strict: %s)', (reactStrictMode) => {
    const didMount = vi.fn();
    const didUnmount = vi.fn();

    class Test extends Component {
      mount() {
        didMount();
        return didUnmount;
      }
    }

    const element = render(<Test />, { reactStrictMode });

    element.rerender(<Test />);

    expect(didMount).toBeCalledTimes(1);
    expect(didUnmount).not.toBeCalled();

    element.unmount();

    expect(didUnmount).toBeCalledTimes(1);
  });

  it('will not call during server render', () => {
    const didMount = vi.fn();

    class Test extends Component {
      mount() {
        didMount();
      }

      render() {
        return <span>hello</span>;
      }
    }

    expect(renderToString(<Test />)).toContain('<span>hello</span>');
    expect(didMount).not.toBeCalled();
  });
});

describe('use method', () => {
  it('will throw if called as a hook', () => {
    class Test extends Component {}

    expect(() => (Test as any).use()).toThrow(
      'Test is a Component - render as an element instead of calling use().'
    );
  });
});

describe('element props', () => {
  class Foo extends Component {
    /** Hover over this prop to see description. */
    value?: string = undefined;
  }

  it('will assign values to instance', () => {
    function Check() {
      expect(Foo.get().value).toBe('foobar');
      return null;
    }

    render(
      <Foo value="foobar">
        <Check />
      </Foo>
    );
  });

  it('will only offer settable members as JSX props', () => {
    class Bar extends Component {
      value = 0;
      onClick = () => {};
      readonly id = 1;
      get computed() { return this.value * 2 }
    }

    render(<Bar value={1} onClick={() => {}} />);

    // @ts-expect-error - get-only accessor is not a settable prop
    (() => <Bar computed={4} />);

    // @ts-expect-error - readonly field is not a settable prop
    (() => <Bar id={2} />);
  });

  it('will trigger set instruction', () => {
    class Foo extends Component {
      value = set('foobar', didSet);
    }

    const didSet = vi.fn();

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
    function Check() {
      // @ts-expect-error
      expect(Foo.get().nonValue).toBeUndefined();
      return null;
    }

    render(
      // @ts-expect-error
      <Foo nonValue="foobar">
        <Check />
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
      children = set<React.ReactNode>(undefined, didUpdate);
    }

    const didUpdate = vi.fn();
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
    const didUpdate = vi.fn();

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

  preactDiffers('will not cause redundant render', async () => {
    const didRender = vi.fn();
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

    expect(didRender).toBeCalled();

    rerender(<Control value="bar" />);

    await expect(control!).toHaveUpdated();

    expect(didRender).toBeCalledTimes(2);
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

  it('will update when a State fetched via this.get changes', async () => {
    class Auth extends State {
      static readonly global = true;
      name = 'foo';
    }

    class Control extends Component {
      render() {
        return <span>{this.get(Auth).name}</span>;
      }
    }

    const auth = Auth.new();
    const screen = render(<Control />);

    expect(screen).toHaveText('foo');

    await act(async () => {
      auth.name = 'bar';
      await auth.set();
    });

    expect(screen).toHaveText('bar');
    auth.set(null);
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

    screen.rerender(<ClassComponent salutation="Bonjour" name="React" />);

    expect(screen).toHaveText('Bonjour React');
  });

  it('will ignore children not handled', () => {
    class Control extends Component {
      render(props = {} as { value: string }) {
        return <>{props.value}</>;
      }
    }

    const screen = render(
      // render declares props but no children, so children should be rejected
      // @ts-expect-error
      <Control value="Goodbye">Hello</Control>
    );

    expect(screen).toHaveText('Goodbye');
    expect(screen).not.toHaveText('Hello');
  });

  it('will accept all-optional render props', () => {
    type ControlProps = {
      base?: string;
      children?: React.ReactNode;
    };

    class Control extends Component {
      render(props: ControlProps = {}) {
        return <>{props.base || props.children}</>;
      }
    }

    const screen = render(<Control base="home" />);

    expect(screen).toHaveText('home');
  });

  it('will handle children if managed by this', () => {
    class Control extends Component {
      children = set<React.ReactNode>();

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
  it('will render and update fallback from property or prop', async () => {
    class Foo extends Component {
      fallback = (<span>Loading!</span>);
      value = set<string>();
    }

    let foo!: Foo;
    const Consumer = () => Foo.get().value;

    const element = render(
      <Foo is={(x) => (foo = x)}>
        <Consumer />
      </Foo>
    );

    expect(element).toHaveText('Loading!');

    await act(async () => {
      foo.fallback = <span>Loading...</span>;
      await flushMicrotasks();
    });

    expect(element).toHaveText('Loading...');

    element.rerender(
      <Foo fallback={<span>Waiting</span>}>
        <Consumer />
      </Foo>
    );

    expect(element).toHaveText('Waiting');

    await act(async () => (foo.value = 'Hello World'));

    expect(element).toHaveText('Hello World');
  });

  it('will fallback when own render suspends', async () => {
    class Foo extends Component {
      value = set<string>();
      fallback = (<span>Loading!</span>);
      render() {
        return this.value;
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

  it.each([
    ['will bubble to an ancestor if fallback is false', false as const, 'OUTER'],
    ['will catch its own subtree by default', <span>INNER</span>, 'INNER']
  ])('%s', async (_, fallback, expected) => {
    const ready = mockPromise<void>();
    let done = false;

    ready.then(() => (done = true));

    const Slow = () => {
      if (!done) throw ready;
      return <span>Hello World</span>;
    };

    class Boundary extends Component {
      fallback = fallback;
    }

    const element = render(
      <React.Suspense fallback={<span>OUTER</span>}>
        <Boundary>
          <Slow />
        </Boundary>
      </React.Suspense>
    );

    expect(element).toHaveText(expected);

    await act(async () => ready.resolve());

    expect(element).toHaveText('Hello World');
  });
});

describe('unmount', () => {
  it.each([false, true])('will dispose instance (strict: %s)', (reactStrictMode) => {
    const didDispose = vi.fn();

    class Control extends Component {
      protected new() {
        return didDispose;
      }
    }

    const element = render(<Control />, { reactStrictMode });

    expect(didDispose).not.toBeCalled();

    element.unmount();

    expect(didDispose).toBeCalled();
  });
});

describe('state props on rerender', () => {
  it('will update and clear omitted instance value', () => {
    class Control extends Component {
      value?: string = 'initial';

      render() {
        return <span>{this.value || 'empty'}</span>;
      }
    }

    const element = render(<Control value="first" />);

    expect(screen).toHaveText('first');

    element.rerender(<Control value="second" />);

    expect(screen).toHaveText('second');

    element.rerender(<Control />);

    expect(screen).toHaveText('empty');
  });

  it('will ignore update after instance destroyed', async () => {
    class Control extends Component {
      value = 'foo';

      render() {
        return <span>{this.value}</span>;
      }
    }

    let instance!: Control;
    const view = render(<Control value="bar" is={(c) => (instance = c)} />);

    expect(screen).toHaveText('bar');

    await act(async () => instance.set(null));

    view.rerender(<Control value="baz" />);

    expect(screen).toHaveText('bar');
  });

  it.each([
    ['will own a fresh state passed as prop', false, true],
    ['will not own an active state passed as prop', true, false]
  ])('%s', (_, active, destroyed) => {
    class Thing extends State {
      value = 'foo';
    }

    class Control extends Component {
      thing?: Thing = undefined;

      render() {
        return <span>{this.thing!.value}</span>;
      }
    }

    const thing = active ? Thing.new() : new Thing();
    const view = render(<Control thing={thing} />);

    expect(screen).toHaveText('foo');

    view.unmount();

    expect(thing.get(null)).toBe(destroyed);
  });
});

describe('render chain', () => {
  it('will stay reactive across composed levels', async () => {
    class Frame extends Component {
      title = 'Base';

      render(props = {} as { children?: React.ReactNode }) {
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
});

describe('subcomponents', () => {
  const error = mockError();

  it('will render last values after owner destroyed', async () => {
    class Control extends Component {
      value = 'foo';

      Inner() {
        return <span>{this.value}</span>;
      }

      render() {
        return <this.Inner />;
      }
    }

    let instance!: Control;
    const view = render(<Control is={(c) => (instance = c)} />);

    expect(screen).toHaveText('foo');

    await act(async () => instance.set(null));

    view.rerender(<Control />);

    expect(screen).toHaveText('foo');
    expect(error).not.toBeCalled();
  });

  it('will render from owner not yet activated', () => {
    class Control extends Component {
      value = 'foo';

      Sidebar() {
        return <span>{this.value}</span>;
      }
    }

    const control = new Control({});

    render(<control.Sidebar />);

    expect(screen).toHaveText('foo');
  });

  it.each([false, true])('will wrap PascalCase method as reactive component (strict: %s)', async (reactStrictMode) => {
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
    render(<Dashboard is={(x) => (instance = x)} />, { reactStrictMode });

    await flushMicrotasks();

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
        return this.props.children;
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

  describe('assigned function', () => {
    class Dashboard extends Component {
      content = 'value';

      Sidebar(): React.ReactNode {
        return null;
      }

      // for coverage
      Ignore = 3;

      render() {
        return <this.Sidebar />;
      }
    }

    function Sidebar(this: Dashboard) {
      return <span>Sidebar {this.content}</span>;
    }

    class Field extends Dashboard {
      Sidebar = Sidebar;
    }

    class Assigned extends Dashboard {
      constructor(props: {}) {
        super(props);
        this.Sidebar = Sidebar as any;
      }
    }

    it.each([
      ['a class field', Field, undefined],
      ['the constructor', Assigned, undefined],
      ['activation', Dashboard, (x: Dashboard) => (x.Sidebar = Sidebar as any)]
    ])('will wrap a function assigned in %s', async (_, Type, assign) => {
      let instance!: Dashboard;

      render(<Type is={(x: any) => ((instance = x), assign?.(x))} />);

      expect(screen).toHaveText('Sidebar value');

      await act(async () => {
        instance.content = 'updated';
      });

      expect(screen).toHaveText('Sidebar updated');
    });
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

  it('will inherit from parent class', () => {
    class Base extends Component {
      Header() {
        return <span>Header</span>;
      }
    }

    class Page extends Base {
      render() {
        return <this.Header />;
      }
    }

    render(<Page />);

    expect(screen).toHaveText('Header');
  });

  it('will compose elements from subclass', () => {
    class Base extends Component {
      Before(): React.ReactNode {
        return null;
      }

      After(): React.ReactNode {
        return null;
      }

      render() {
        return (
          <>
            <this.Before />
            <span>Main</span>
            <this.After />
          </>
        );
      }
    }

    class Page extends Base {
      Before() {
        return <span>Header</span>;
      }

      After() {
        return <span>Footer</span>;
      }
    }

    const element = render(<Page />);

    expect(element).toHaveText('Header');
    expect(element).toHaveText('Main');
    expect(element).toHaveText('Footer');
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

describe('hot patch', () => {
  const version = (text: string) => {
    class Control extends Component {
      value = 1;

      Label() {
        return <b>{text}</b>;
      }

      render() {
        const { value, Label } = this;
        return <><Label />{value}</>;
      }
    }
    return Control;
  };

  it('will patch a subcomponent in place', async () => {
    const Control = version('before');

    hot.accept('subcomponent-live', { Control });

    const element = render(<Control value={2} />);

    expect(element.container.textContent).toBe('before2');

    await act(async () => void hot.accept('subcomponent-live', { Control: version('after') }));

    expect(element.container.textContent).toBe('after2');
  });

  it('will patch a subcomponent for new instances', () => {
    const Control = version('before');

    hot.accept('subcomponent-new', { Control });
    render(<Control />).unmount();
    hot.accept('subcomponent-new', { Control: version('after') });

    expect(render(<Control />).container.textContent).toBe('after1');
  });
});

describe('strict mode', () => {
  it('will construct once per kept instance', async () => {
    const warn = mockWarn();
    const didCreate = vi.fn();
    const didDestroy = vi.fn();

    class Child extends State {
      new() {
        didCreate();
        return didDestroy;
      }
    }

    class Control extends Component {
      child = new Child();
      #secret = 'bar';

      render() {
        return <span>{this.reveal()}</span>;
      }

      reveal() {
        return this.#secret;
      }
    }

    const element = render(
      <React.StrictMode>
        <Control />
      </React.StrictMode>
    );

    await flushMicrotasks();

    expect(screen).toHaveText('bar');
    expect(didCreate).toBeCalledTimes(1);
    expect(didDestroy).not.toBeCalled();
    expect(warn).not.toBeCalled();

    element.unmount();

    expect(didDestroy).toBeCalledTimes(1);
  });

  it('will refresh via property and props update', async () => {
    const didRender = vi.fn();
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

    const element = render(<Control />, { reactStrictMode: true });

    await flushMicrotasks();

    expect(screen).toHaveText('bar');

    await act(async () => {
      instance.foo = 'baz';
    });

    expect(screen).toHaveText('baz');
    expect(didRender).toBeCalledWith('baz');

    element.rerender(<Control foo="qux" />);

    await flushMicrotasks();

    expect(screen).toHaveText('qux');
    expect(didRender).toBeCalledWith('qux');
  });

  reactOnly.it('will survive define-semantics field clobber', async () => {
    const didAttemptConstruct = vi.fn();

    class Control extends Component {
      foo = 'foo';

      constructor(props: any, ...rest: any[]) {
        didAttemptConstruct();
        super(props, ...rest);
      }
    }

    let instance!: Control;
    render(
      <React.StrictMode>
        <Control is={(is) => (instance = is)} />
      </React.StrictMode>
    );

    expect(didAttemptConstruct).toBeCalledTimes(2);

    const effect = vi.fn();
    instance.get(($) => {
      effect($.foo);
    });

    expect(effect).toBeCalledWith('foo');
    instance.foo = 'bar';

    await instance.set();

    expect(effect).toBeCalledWith('bar');
  });

  reactOnly.it('will construct twice then init once', async () => {
    const order: string[] = [];

    class Control extends Component {
      constructor(props: any, ...rest: any[]) {
        super(props, ...rest);
        order.push('construct');
      }
    }

    Control.on({ setup: () => void order.push('init') });

    render(
      <React.StrictMode>
        <Control />
      </React.StrictMode>
    );

    await flushMicrotasks();

    expect(order).toEqual(['construct', 'construct', 'init']);
  });
});

describe('for', () => {
  class Session extends State {
    name = 'none';
  }

  function Name() {
    return <>{Session.get().name}</>;
  }

  it('will construct, provide, mount and destroy a class', () => {
    const released = vi.fn();
    let session!: Owned;

    class Owned extends Session {
      mount() {
        return released;
      }
    }

    const view = render(
      <Component for={Owned} name="Ada" is={(s: Owned) => (session = s)}>
        <Name />
      </Component>
    );

    expect(screen).toHaveText('Ada');

    view.unmount();

    expect(released).toBeCalledTimes(1);
    expect(session.get(null)).toBe(true);
  });

  it('will provide an instance without owning it', async () => {
    const session = Session.new();

    const view = render(
      <Component for={session} name="Ada">
        <Name />
      </Component>
    );

    view.rerender(
      <Component for={session} name="Grace">
        <Name />
      </Component>
    );

    await act(async () => {});

    expect(screen).toHaveText('Grace');

    view.unmount();

    expect(session.get(null)).toBe(false);
  });

  it('will keep one provided class under StrictMode', () => {
    const made: Session[] = [];

    class Tracked extends Session {
      protected new() {
        made.push(this);
      }
    }

    function Read() {
      return <>{String(made.indexOf(Tracked.get().is))}</>;
    }

    const view = render(
      <React.StrictMode>
        <Component for={Tracked}>
          <Read />
        </Component>
      </React.StrictMode>
    );

    expect(made).toHaveLength(1);
    expect(screen).toHaveText('0');

    view.unmount();

    expect(made[0].get(null)).toBe(true);
  });

  it('will replace an instance made each render', async () => {
    const made: Session[] = [];

    function Read() {
      return <>{String(made.indexOf(Session.get().is))}</>;
    }

    function View({ n }: { n: number }) {
      const session = new Session();
      made.push(session);
      return <Component for={session} name={String(n)}><Read /></Component>;
    }

    const view = render(<View n={0} />);

    view.rerender(<View n={1} />);
    await act(async () => {});

    const live = made.filter((s) => !s.get(null));

    expect(live).toHaveLength(1);
    expect(screen).toHaveText(String(made.indexOf(live[0])));

    view.unmount();

    expect(made.every((s) => s.get(null))).toBe(true);
  });

  it('will type attributes from for', () => {
    class Typed extends State {
      name = '';
      age = 0;
    }

    class Sub extends Component {}

    const plain: Component = Component.new();
    const list: Component[] = [new Component(), plain];

    void (() => [
      list,
      <Component for={Typed} name="Ada" is={(typed) => typed.age.toFixed()} />,
      <Component for={Typed.new()} age={2} />,
      <Component fallback={null} />,
      // @ts-expect-error
      <Component for={Typed} name={1} />,
      // @ts-expect-error
      <Component for={Typed} nope="x" />,
      // @ts-expect-error
      <Component for={Typed.new()} is={() => {}} />,
      // @ts-expect-error
      <Sub for={Typed} />
    ]);
  });

  it('will not add a suspense boundary', async () => {
    const gate = mockPromise();

    function Wait(): React.ReactNode {
      throw gate;
    }

    render(
      <Suspense fallback="outer">
        <Component for={Session}>
          <Wait />
        </Component>
      </Suspense>
    );

    expect(screen).toHaveText('outer');
  });
});

describe('owner', () => {
  it('will be owned by enclosing Component', () => {
    let outer!: Outer;
    let inner!: Inner;

    class Inner extends Component {}
    class Outer extends Component {
      render() {
        return <Inner is={(i) => (inner = i)} />;
      }
    }

    render(<Outer is={(o) => (outer = o)} />);

    expect(outer.get(State, false)).toBeUndefined();
    expect(inner.get(State)).toBe(outer);
    expect(inner.get(Component)).toBe(outer);
  });

  it('will report and drop hosted Components', async () => {
    const owned = vi.fn();
    const dropped = vi.fn();
    let outer!: Outer;

    class Inner extends Component {}
    class Outer extends Component {
      show = true;

      render() {
        return this.show && <Inner />;
      }
    }

    render(<Outer is={(o) => (outer = o)} />);

    outer.get(State, (child) => {
      owned(child);
      return dropped;
    }, true);

    expect(owned).toHaveBeenCalledWith(expect.any(Inner));

    await act(async () => {
      outer.show = false;
    });

    expect(dropped).toHaveBeenCalledTimes(1);
  });

  it('will be owned by Component providing it', () => {
    let session!: State;
    let host!: State;

    class Session extends State {}
    class Host extends Component {
      render() {
        return <Component for={Session} is={(s) => (session = s)} />;
      }
    }

    render(<Host is={(h) => (host = h)} />);

    const wrapper = session.get(State);

    expect(wrapper).toBeInstanceOf(Component);
    expect(wrapper.get(State)).toBe(host);
  });
});
