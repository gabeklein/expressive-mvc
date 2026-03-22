import { vi, expect, it, describe, act, render, screen } from '../vitest';

import React, { Component as ReactComponent } from 'react';
import State, { Component, Consumer, Provider, get, set } from '.';

describe('Provider usage', () => {
  it('will create and provide instance', () => {
    class Control extends State {
      foo = 'bar';
    }

    render(
      <Provider for={Control}>
        <Consumer for={Control}>{(c) => c.foo}</Consumer>
      </Provider>
    );

    screen.getByText('bar');
  });

  it('will create instance only once', () => {
    class Control extends State {
      protected new() {
        didConstruct(this);
      }
    }

    const didConstruct = vi.fn();
    const { rerender } = render(<Provider for={Control} />);

    expect(didConstruct).toBeCalledTimes(1);

    rerender(<Provider for={Control} />);

    expect(didConstruct).toBeCalledTimes(1);
  });

  it('will call is method on creation', () => {
    class Control extends State {}

    const didCreate = vi.fn();

    const screen = render(<Provider for={Control} is={didCreate} />);

    expect(didCreate).toBeCalledTimes(1);

    screen.rerender(<Provider for={Control} is={didCreate} />);
    expect(didCreate).toBeCalledTimes(1);

    act(screen.unmount);
  });
});

describe('new method', () => {
  it('will call if exists', () => {
    const didCreate = vi.fn();

    class Test extends Component {
      protected new() {
        didCreate();
      }

      render() {
        return null;
      }
    }

    const element = render(<Test />);

    expect(didCreate).toBeCalled();

    element.rerender(<Test />);

    expect(didCreate).toBeCalledTimes(1);
  });
});

describe('element props', () => {
  it('will accept managed values via Provider', () => {
    class Foo extends State {
      value?: string = undefined;
    }

    render(
      <Provider for={Foo} value="baz">
        <Consumer for={Foo}>
          {(c) => {
            expect(c.value).toBe('baz');
          }}
        </Consumer>
      </Provider>
    );
  });

  it('will assign values to instance via Provider', () => {
    class Foo extends State {
      value?: string = undefined;
    }

    render(
      <Provider for={Foo} value="foobar">
        <Consumer for={Foo}>
          {(i) => {
            expect(i.value).toBe('foobar');
          }}
        </Consumer>
      </Provider>
    );
  });

  it('will trigger set instruction', () => {
    class Foo extends State {
      value = set('foobar', didSet);
    }

    const didSet = vi.fn();

    render(<Provider for={Foo} value="barfoo" />);

    expect(didSet).toBeCalled();
  });

  it('will override method on Component', async () => {
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
});

describe('element children', () => {
  it('will handle multiple elements via Provider', () => {
    class Control extends State {
      foo = 'bar';
    }

    const screen = render(
      <Provider for={Control} foo="sd">
        <span>Hello</span>
        <span>World</span>
      </Provider>
    );

    screen.getByText('Hello');
    screen.getByText('World');
  });

  it('will accept children with render', () => {
    class Control extends Component {
      render() {
        expect(this.props.children).toBe('Hello');
        return 'Rendered';
      }
    }

    const screen = render(<Control>Hello</Control>);

    screen.getByText('Rendered');
  });
});

describe('props property', () => {
  it('will update on rerender', () => {
    class Control extends Component<{ value: string }> {
      render() {
        return <>{this.props.value}</>;
      }
    }

    const { rerender } = render(<Control value="foo" />);
    screen.getByText('foo');

    rerender(<Control value="bar" />);
    screen.getByText('bar');
  });

  it('will be accessible on instance', () => {
    class Control extends Component<{ value: string }> {
      render() {
        return null;
      }
    }

    let ctrl!: Control;
    render(<Control value="hello" is={(x) => (ctrl = x)} />);
    expect(ctrl.props.value).toBe('hello');
  });
});

describe('render method', () => {
  it('will be element output', () => {
    class Control extends Component<{ bar: string }> {
      foo = 'bar';

      render() {
        return (
          <>
            <span>{this.props.bar}</span>
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
    function FunctionComponent(this: ClassComponent) {
      return (
        <div>
          {this.salutation} {this.props.name}
        </div>
      );
    }

    class ClassComponent extends Component<{ name: string }> {
      salutation = 'Hello';
      render = FunctionComponent;
    }

    const screen = render(<ClassComponent name="World" />);

    screen.getByText('Hello World');

    screen.rerender(<ClassComponent salutation="Bonjour" name="React" />);

    screen.getByText('Bonjour React');
  });

  it('will ignore children not handled', () => {
    class Control extends Component<{ value: string }> {
      render() {
        return <>{this.props.value}</>;
      }
    }

    const screen = render(<Control value="Goodbye">Hello</Control>);

    screen.getByText('Goodbye');
    expect(screen.queryByText('Hello')).toBe(null);
  });

  it('will handle children if managed by this', () => {
    class Control extends Component<{ value: string }> {
      children = set<React.ReactNode>();

      render() {
        return (
          <>
            <span>{this.props.value}</span>
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
    const screen = render(<Control is={(x: Control) => (control = x)} />);

    screen.getByText('bar');

    await act(async () => {
      control.value = 'foo';
      await control.set();
    });

    screen.getByText('foo');
  });
});

describe('types', () => {
  it('will not compromise existing Component props', () => {
    const FunctionComponent = (props: {
      /** this is foo */
      foo: string;
    }) => {
      return <div>Hello {props.foo}</div>;
    };

    class ClassComponent extends ReactComponent<{ bar: string }> {
      render() {
        return <div>Hello {this.props.bar}</div>;
      }
    }

    const screen = render(<FunctionComponent foo="bar" />);

    screen.getByText('Hello bar');

    screen.rerender(<ClassComponent bar="baz" />);

    screen.getByText('Hello baz');
  });
});

describe('suspense', () => {
  it('will render fallback prop via Provider', async () => {
    class Foo extends State {
      value = set<string>();
    }

    let foo!: Foo;
    const FooConsumer = () => (foo = Foo.get()).value;

    const element = render(
      <Provider for={Foo} fallback={<span>Loading...</span>}>
        <FooConsumer />
      </Provider>
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

    const element = render(<Foo is={(x: Foo) => (foo = x)} />);

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

      render() {
        return <Consumer for={Foo}>{(f) => f.value}</Consumer>;
      }
    }

    let foo!: Foo;

    const element = render(<Foo is={(x: Foo) => (foo = x)} />);

    element.getByText('Loading!');

    element.rerender(<Foo fallback={<span>Loading...</span>} />);

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

      render() {
        return <Consumer for={Foo}>{(f) => f.value}</Consumer>;
      }
    }

    let foo!: Foo;

    const element = render(<Foo is={(x: Foo) => (foo = x)} />);

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

describe.skip('implicit context', () => {
  it('will provide automatically', async () => {
    class Parent extends State {
      value = 'foobar';
    }
    class Child extends State {
      parent = get(Parent);
    }

    let parent: Parent;
    const Outer = (props: React.PropsWithChildren) => {
      parent = Parent.use().is;
      return props.children;
    };

    const Inner = () => {
      return Child.use().parent.value;
    };

    render(
      <Outer>
        <Inner />
      </Outer>
    );

    screen.getByText('foobar');

    await act(async () => parent.set({ value: 'barfoo' }));

    screen.getByText('barfoo');
  });
});
