import { State, Component, set } from '.';
import { vi, expect, it, describe, act, render, screen } from '../vitest';

it('will render Component in JSX', () => {
  class Test extends Component {
    value = 'Hello';

    render() {
      return <span>{this.value}</span>;
    }
  }

  render(<Test />);
  screen.getByText('Hello');
});

it('will not treat plain State as a React component', () => {
  class Test extends State {
    value = 'Hello';
  }

  // State should not have isReactComponent
  expect(Object.getPrototypeOf(new Test()).isReactComponent).toBeFalsy();
});

it('will treat Component as a React component', () => {
  class Test extends Component {
    render() {
      return null;
    }
  }

  const instance = Object.create(Test.prototype);
  expect(instance.isReactComponent).toBe(true);
});

describe('Component', () => {
  it('will create extensible component', () => {
    class Test extends Component {
      something = 'World';

      render() {
        return <span>Hello {this.something}</span>;
      }
    }

    class Test2 extends Test {
      something = 'Tester';
    }

    const element = render(<Test2 />);

    element.getByText('Hello Tester');
  });

  it('will render children as passthrough', () => {
    class Test extends Component {
      name = 'World';

      render() {
        return this.props.children || null;
      }
    }

    const Consumer = () => {
      const { name } = Test.get();

      return <div>Hello {name}</div>;
    };

    const element = render(
      <Test name="Tester">
        <Consumer />
      </Test>
    );

    element.getByText('Hello Tester');
  });

  it('will merge props into state', async () => {
    const didUpdateFoo = vi.fn();

    class Test extends Component {
      foo = 'foo';

      protected new() {
        this.set(didUpdateFoo);
      }

      render() {
        return <span>{this.foo}</span>;
      }
    }

    const { rerender } = render(<Test foo="bar" />);

    screen.getByText('bar');
    expect(didUpdateFoo).not.toBeCalled();

    rerender(<Test foo="baz" />);

    screen.getByText('baz');
    expect(didUpdateFoo).toBeCalledTimes(1);
    expect(didUpdateFoo).toBeCalledWith(
      'foo',
      expect.objectContaining({ foo: 'baz' })
    );
  });

  it('will retain local updates over initial props', async () => {
    let test: Test;
    const didSetFoo = vi.fn();

    class Test extends Component {
      foo = 'foo';

      protected new() {
        test = this;
        this.set(didSetFoo);
      }

      render() {
        return <span>{this.foo}</span>;
      }
    }

    const renderSpy = vi.spyOn(Test.prototype, 'render');

    render(<Test foo="bar" />);

    screen.getByText('bar');

    await act(async () => {
      test.foo = 'baz';
      await test.set();
      expect(test.foo).toBe('baz');
    });

    screen.getByText('baz');

    expect(didSetFoo).toBeCalledTimes(1);
    expect(renderSpy).toBeCalledTimes(2);
  });

  it('will render fallback when suspended', async () => {
    class Foo extends Component {
      value = set<string>();

      render() {
        return <Consumer />;
      }
    }

    let foo!: Foo;
    const Consumer = () => (foo = Foo.get()).value;

    const element = render(<Foo fallback={<span>Loading...</span>} />);

    element.getByText('Loading...');

    await act(async () => (foo.value = 'Hello World'));

    element.getByText('Hello World');
  });
});
