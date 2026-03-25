import { vi, expect, it, describe, act, render, screen } from '../vitest';

import React from 'react';
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

it('will create instance only once', () => {
  class Control extends Component {
    protected new() {
      didConstruct(this);
    }
  }

  const didConstruct = vi.fn();
  const { rerender } = render(<Control />);

  expect(didConstruct).toBeCalledTimes(1);

  rerender(<Control />);

  expect(didConstruct).toBeCalledTimes(1);
});

it('will call is method on creation', () => {
  class Control extends Component {}

  const didCreate = vi.fn();

  const screen = render(<Control is={didCreate} />);

  expect(didCreate).toBeCalledTimes(1);

  screen.rerender(<Control is={didCreate} />);
  expect(didCreate).toBeCalledTimes(1);

  act(screen.unmount);
});

describe('new method', () => {
  it('will call if exists', () => {
    const didCreate = vi.fn();

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

    const didUpdate = vi.fn();
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

  it('will not cause redundant render', async () => {
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
  it('will dispose instance', () => {
    const didDispose = vi.fn();

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

    screen.getByText('first');

    element.rerender(<Control value="second" />);

    screen.getByText('second');
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

describe('strict mode', () => {
  it('will not create two instances', async () => {
    const didCreate = vi.fn();
    const didDestroy = vi.fn();

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
    const didRender = vi.fn();

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
