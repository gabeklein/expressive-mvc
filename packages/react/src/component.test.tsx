import { render, screen, act } from '@testing-library/react';
import { mock, expect, it, describe } from 'bun:test';
import React from 'react';

import { mockError, mockPromise } from '../test.setup';
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

  screen.getByText('bar');
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

it('will create instance only once', () => {
  class Control extends Component {
    protected new() {
      didConstruct(this);
    }
  }

  const didConstruct = mock();
  const { rerender } = render(<Control />);

  expect(didConstruct).toBeCalledTimes(1);

  rerender(<Control />);

  expect(didConstruct).toBeCalledTimes(1);
});

it('will call is method on creation', () => {
  class Control extends Component {}

  const didCreate = mock();

  const screen = render(<Control is={didCreate} />);

  expect(didCreate).toBeCalledTimes(1);

  screen.rerender(<Control is={didCreate} />);
  expect(didCreate).toBeCalledTimes(1);

  act(screen.unmount);
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

  it('will assign values to instance', () => {
    render(
      <Foo value="foobar">
        <Consumer for={Foo}>
          {(i) => {
            expect(i.value).toBe('foobar');
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
    screen.getByText('bar');

    element.rerender(<Test callback={() => 'baz'} />);
    screen.getByText('baz');
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

    screen.getByText('Hello');
    screen.getByText('World');
  });

  it('will notify parent', async () => {
    class Control extends Component {
      children = set<React.ReactNode>(undefined, didUpdate);
    }

    const didUpdate = mock();
    const screen = render(<Control>Hello</Control>);

    screen.getByText('Hello');
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

    screen.getByText('Hello');
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
    screen.getByText('foo');

    rerender(<Control value="bar" />);
    screen.getByText('bar');
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

    screen.getByText('foo');
    screen.getByText('bar');
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

    screen.getByText('Hello World');

    screen.rerender(<ClassComponent salutation="Bonjour" name="React" />);

    screen.getByText('Bonjour React');
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

    screen.getByText('Goodbye');
    expect(screen.queryByText('Hello')).toBe(null);
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

    screen.getByText('home');
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

    screen.getByText('Hello');
    screen.getByText('World');
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

    screen.getByText('bar');

    await act(async () => {
      control.value = 'foo';
      await control.set();
    });

    screen.getByText('foo');
  });
});

describe('suspense', () => {
  it('will render fallback property', async () => {
    class Foo extends Component {
      fallback = (<span>Loading...</span>);
      value = set<string>();
    }

    let foo!: Foo;
    const Consumer = () => (foo = Foo.get()).value;

    const element = render(
      <Foo>
        <Consumer />
      </Foo>
    );

    element.getByText('Loading...');

    await act(async () => (foo.value = 'Hello World'));

    element.getByText('Hello World');
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

    element.getByText('Loading!');

    await act(async () => {
      foo.value = 'Hello World';
    });

    element.getByText('Hello World');
  });

  it('will use fallback property first', async () => {
    class Foo extends Component {
      value = set<string>();
      fallback = (<span>Loading!</span>);
    }

    let foo!: Foo;
    const Consumer = () => Foo.get().value;

    const element = render(
      <Foo is={(x) => (foo = x)}>
        <Consumer />
      </Foo>
    );

    element.getByText('Loading!');

    element.rerender(
      <Foo fallback={<span>Loading...</span>}>
        <Consumer />
      </Foo>
    );

    element.getByText('Loading...');

    await act(async () => {
      foo.value = 'Hello World';
    });

    element.getByText('Hello World');
  });

  it('will update with new fallback', async () => {
    class Foo extends Component {
      value = set<string>();
      fallback = (<span>Loading!</span>);
    }

    let foo!: Foo;
    const Consumer = () => Foo.get().value;

    const element = render(
      <Foo is={(x) => (foo = x)}>
        <Consumer />
      </Foo>
    );

    element.getByText('Loading!');

    await act(async () => {
      foo.fallback = <span>Loading...</span>;
      await new Promise((r) => setTimeout(r, 0));
    });

    element.getByText('Loading...');

    await act(async () => {
      foo.value = 'Hello World';
      await new Promise((r) => setTimeout(r, 0));
    });

    element.getByText('Hello World');
  });
});

describe('unmount', () => {
  for (const reactStrictMode of [false, true])
    it('will dispose instance' + (reactStrictMode ? ' (strict)' : ''), () => {
      const didDispose = mock();

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
  it('will update instance value', () => {
    class Control extends Component {
      value = 'initial';

      render() {
        return <span>{this.value}</span>;
      }
    }

    const element = render(<Control value="first" />);

    screen.getByText('first');

    element.rerender(<Control value="second" />);

    screen.getByText('second');
  });

  it('will clear omitted instance value', () => {
    class Control extends Component {
      value?: string = 'initial';

      render() {
        return <span>{this.value || 'empty'}</span>;
      }
    }

    const element = render(<Control value="first" />);

    screen.getByText('first');

    element.rerender(<Control />);

    screen.getByText('empty');
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

    screen.getByText('Hello World');
  });

  it('will provide instance created', () => {
    class Parent extends Component {
      value = 'foobar';
    }
    const Child = () => Parent.get().value;

    const element = render(
      <Parent>
        <Child />
      </Parent>
    );

    element.getByText('foobar');
  });
});

describe('error boundary', () => {
  mockError();

  it('will show fallback when child throws', async () => {
    const Throws = () => {
      throw new Error('boom');
    };

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      async catch(_error: Error) {
        // never resolves - stays in fallback
        await new Promise(() => {});
      }

      render() {
        return <Throws />;
      }
    }

    render(<Boundary />);

    screen.getByText('Oops');
  });

  it('will recover when catch resolves', async () => {
    let shouldThrow = true;
    let resolve!: () => void;

    const MaybeThrows = () => {
      if (shouldThrow) throw new Error('boom');
      return <span>Recovered</span>;
    };

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      async catch(_error: Error) {
        await new Promise<void>((r) => {
          resolve = r;
        });
        shouldThrow = false;
      }

      render() {
        return <MaybeThrows />;
      }
    }

    render(<Boundary />);

    screen.getByText('Oops');

    await act(async () => resolve());

    screen.getByText('Recovered');
  });

  it('will restore fallback after catch resolves', async () => {
    let throwing: any = new Error('boom');
    let resolve!: () => void;
    let instance!: Boundary;

    class Boundary extends Component {
      value = 'initial';
      fallback = (<span>Default Loading</span>);

      new() {
        instance = this;
      }

      async catch(_error: Error) {
        this.fallback = <span>Error Fallback</span>;
        await new Promise<void>((r) => (resolve = r));
        throwing = null;
      }

      render() {
        if (throwing) throw throwing;
        return <span>{this.value}</span>;
      }
    }

    render(<Boundary />);
    await act(async () => {});

    // error boundary shows error-specific fallback
    screen.getByText('Error Fallback');

    await act(async () => resolve());

    // error recovered, render works again
    screen.getByText('initial');

    // suspend from render - fallback was restored so suspense uses default
    await act(async () => {
      throwing = new Promise(() => {});
      instance.value = 'trigger';
    });

    screen.getByText('Default Loading');
  });

  it('will propagate if render throws after recovery', async () => {
    const parentCatch = mock();
    let resolve!: () => void;

    const Throws = () => {
      throw new Error('boom');
    };

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      async catch() {
        await new Promise<void>((r) => (resolve = r));
      }

      render() {
        return <Throws />;
      }
    }

    class Parent extends Component {
      fallback = (<span>Parent Caught</span>);

      async catch(error: Error) {
        parentCatch(error.message);
        await new Promise(() => {});
      }

      render() {
        return <Boundary />;
      }
    }

    render(<Parent />);

    screen.getByText('Oops');

    // resolve catch but render will throw again
    await act(async () => resolve());

    // error propagated to parent boundary
    screen.getByText('Parent Caught');
    expect(parentCatch).toBeCalledWith('boom');
  });

  it('will propagate catch rejection to parent boundary', async () => {
    const parentCatch = mock();

    const Throws = () => {
      throw new Error('boom');
    };

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      async catch() {
        throw new Error('recovery failed');
      }

      render() {
        return <Throws />;
      }
    }

    class Parent extends Component {
      fallback = (<span>Parent Caught</span>);

      catch(error: Error) {
        parentCatch(error.message);
        return new Promise<void>(() => {});
      }

      render() {
        return <Boundary />;
      }
    }

    render(<Parent />);

    await act(async () => {});

    screen.getByText('Parent Caught');
    expect(parentCatch).toBeCalledWith('recovery failed');
  });

  it('will catch new error after successful recovery', async () => {
    let catchCount = 0;
    let shouldThrow = true;
    let resolve!: () => void;
    let instance!: Boundary;

    const MaybeThrows = () => {
      if (shouldThrow) throw new Error('boom');
      return <span>Recovered</span>;
    };

    class Boundary extends Component {
      value = 0;
      fallback = (<span>Oops</span>);

      new() {
        instance = this;
      }

      async catch() {
        catchCount++;
        await new Promise<void>((r) => (resolve = r));
      }

      render() {
        void this.value;
        return <MaybeThrows />;
      }
    }

    render(<Boundary />);

    screen.getByText('Oops');
    expect(catchCount).toBe(1);

    // fix the error, then resolve catch
    shouldThrow = false;
    await act(async () => resolve());

    // successful recovery
    screen.getByText('Recovered');

    // new error occurs later
    await act(async () => {
      shouldThrow = true;
      instance.value++;
    });

    // catch runs again for the new error
    expect(catchCount).toBe(2);
    screen.getByText('Oops');
  });

  it('will pass error to catch', async () => {
    const caught = mock();

    const Throws = () => {
      throw new Error('specific error');
    };

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      async catch(error: Error) {
        caught(error);
      }

      render() {
        return <Throws />;
      }
    }

    render(<Boundary />);

    expect(caught).toBeCalledTimes(1);
    expect(caught.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(caught.mock.calls[0][0].message).toBe('specific error');
  });

  it('will recover immediately with sync catch', async () => {
    let shouldThrow = true;

    const MaybeThrows = () => {
      if (shouldThrow) throw new Error('boom');
      return <span>Recovered</span>;
    };

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      catch() {
        shouldThrow = false;
      }

      render() {
        return <MaybeThrows />;
      }
    }

    render(<Boundary />);

    await act(async () => {});

    screen.getByText('Recovered');
  });

  it('will restore fallback after sync catch', async () => {
    let throwing: any = new Error('boom');
    let instance!: Boundary;

    class Boundary extends Component {
      value = 'initial';
      fallback = (<span>Default Loading</span>);

      new() {
        instance = this;
      }

      catch() {
        this.fallback = <span>Error Fallback</span>;
        throwing = null;
      }

      render() {
        if (throwing) throw throwing;
        return <span>{this.value}</span>;
      }
    }

    render(<Boundary />);
    await act(async () => {});

    screen.getByText('initial');

    await act(async () => {
      throwing = new Promise(() => {});
      instance.value = 'trigger';
    });

    screen.getByText('Default Loading');
  });

  it('will call catch exactly once per thrown error', async () => {
    const catchSpy = mock();

    const Throws = () => {
      throw new Error('boom');
    };

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      async catch(error: Error) {
        catchSpy(error);
        await new Promise(() => {});
      }

      render() {
        return <Throws />;
      }
    }

    render(<Boundary />);
    await act(async () => {});

    expect(catchSpy).toBeCalledTimes(1);
  });

  it('will propagate without catch defined', () => {
    const Throws = () => {
      throw new Error('boom');
    };

    class Inner extends Component {
      render() {
        return <Throws />;
      }
    }

    class Outer extends Component {
      fallback = (<span>Caught by outer</span>);

      async catch() {
        await new Promise(() => {});
      }

      render() {
        return <Inner />;
      }
    }

    render(<Outer />);

    screen.getByText('Caught by outer');
  });

  it('will not error if unmounted during catch', async () => {
    const Throws = () => {
      throw new Error('boom');
    };
    const promise = mockPromise();
    let boundary!: Boundary;

    class Boundary extends Component {
      fallback = (<span>Oops</span>);

      new() {
        boundary = this;
      }

      async catch(_error: Error) {
        await promise;
      }

      render() {
        return <Throws />;
      }
    }

    const element = render(<Boundary />);

    screen.getByText('Oops');

    await act(async () => element.unmount());

    expect(boundary.get(null)).toBe(true);

    // resolving after unmount should not throw
    const errors: Error[] = [];

    function trap(_: unknown, reason: Error) {
      errors.push(reason);
    }

    process.on('unhandledRejection', trap);
    promise.resolve();

    process.off('unhandledRejection', trap);
    expect(errors).toHaveLength(0);
  });

  for (const reactStrictMode of [false, true])
    it('will dispose instance if unmounted in error state' + (reactStrictMode ? ' (strict)' : ''), async () => {
      const didDispose = mock();
      const Throws = () => {
        throw new Error('boom');
      };

      class Control extends Component {
        fallback = (<span>Oops</span>);

        new() {
          return didDispose;
        }

        async catch() {
          await new Promise(() => {});
        }

        render() {
          return <Throws />;
        }
      }

      const element = render(<Control />, { reactStrictMode });

      screen.getByText('Oops');
      expect(didDispose).not.toBeCalled();

      element.unmount();

      expect(didDispose).toBeCalled();
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

    screen.getByText('Hello');

    await act(async () => {
      instance.label = 'Updated';
    });

    screen.getByText('Updated');
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

    screen.getByText('Sidebar Content');
  });

  it('will work with assigned function', async () => {
    class Dashboard extends Component {
      Sidebar(): React.ReactNode {
        return null;
      }

      // for coverage
      Ignore = 3;

      render() {
        return <this.Sidebar />;
      }
    }

    class MyDashboard extends Dashboard {
      content = 'value';
      Sidebar = Sidebar;

      new() {
        dashboard = this;
      }
    }

    function Sidebar(this: MyDashboard) {
      return <span>Sidebar {this.content}</span>;
    }

    let dashboard!: MyDashboard;

    render(<MyDashboard />);

    screen.getByText('Sidebar value');

    await act(async () => {
      dashboard.content = 'updated';
    });

    screen.getByText('Sidebar updated');
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

    screen.getByText('Original');

    await act(async () => {
      instance.Sidebar = function (this: Dashboard) {
        return <span>Replaced: {this.value}</span>;
      } as any;
      instance.value = 'yes';
    });

    screen.getByText('Replaced: yes');
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

    screen.getByText('Header');
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

    element.getByText('Header');
    element.getByText('Main');
    element.getByText('Footer');
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

    screen.getByText('Dynamic Label');
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
      <React.StrictMode>
        <Dashboard is={(x) => (instance = x)} />
      </React.StrictMode>
    );

    await new Promise((r) => setTimeout(r, 0));

    screen.getByText('Hello');

    await act(async () => {
      instance.label = 'Updated';
    });

    screen.getByText('Updated');

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

    screen.getByText('a: Hello');
    screen.getByText('b: Hello');

    await act(async () => {
      instance.label = 'World';
    });

    screen.getByText('a: World');
    screen.getByText('b: World');
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

    screen.getByText('x');
    screen.getByText('y');

    const before = { ...renders };

    await act(async () => {
      instance.x = 'x2';
    });

    screen.getByText('x2');
    screen.getByText('y');

    // only the "a" instance should have re-rendered
    expect(renders.a).toBe(before.a + 1);
    expect(renders.b).toBe(before.b);
  });
});

describe('strict mode', () => {
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
      <React.StrictMode>
        <Control />
      </React.StrictMode>
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
      <React.StrictMode>
        <Control />
      </React.StrictMode>
    );

    await new Promise((r) => setTimeout(r, 0));

    screen.getByText('bar');

    await act(async () => {
      instance.foo = 'baz';
    });

    screen.getByText('baz');
    expect(didRender).toBeCalledWith('baz');

    await act(async () => {
      instance.foo = 'qux';
    });

    screen.getByText('qux');
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
      <React.StrictMode>
        <Control />
      </React.StrictMode>
    );

    await new Promise((r) => setTimeout(r, 0));

    screen.getByText('bar');
    didRender.mockClear();

    rerender(
      <React.StrictMode>
        <Control foo="baz" />
      </React.StrictMode>
    );

    await new Promise((r) => setTimeout(r, 0));

    screen.getByText('baz');
    expect(didRender).toBeCalledWith('baz');
  });
});
