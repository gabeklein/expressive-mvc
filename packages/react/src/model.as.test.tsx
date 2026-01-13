import { act, render, screen } from '@testing-library/react';

import Model from '.';
import { set } from '@expressive/mvc';

it('will update component as values change', async () => {
  class Test extends Model {
    foo = 'bar';
    constructor() {
      super();
      test = this;
    }
  }
  let test: Test;
  const Component = Test.as((_, self) => {
    return <span>{self.foo}</span>;
  });

  render(<Component />);
  screen.getByText('bar');

  await act(async () => {
    test.foo = 'baz';
    await test.set();
  });

  screen.getByText('baz');
});

it('will pass props to model', async () => {
  const didUpdateFoo = jest.fn();
  class Test extends Model {
    foo = 'foo';
    constructor(...args: Model.Args) {
      super(...args);
      this.set(didUpdateFoo);
    }
  }
  const Component = Test.as(({ foo }) => <span>{foo}</span>);
  const { rerender } = render(<Component foo="bar" />);

  screen.getByText('bar');
  expect(didUpdateFoo).not.toHaveBeenCalled();

  rerender(<Component foo="baz" />);

  screen.getByText('baz');
  expect(didUpdateFoo).toHaveBeenCalledTimes(1);
  expect(didUpdateFoo).toHaveBeenCalledWith('foo', { foo: 'baz' });
});

it('will pass props before effects run', async () => {
  class Test extends Model {
    foo = 'foo';

    constructor(...args: Model.Args) {
      super(...args, (self) => {
        expect(self.foo).toBe('bar');
      });
    }
  }

  const Component = Test.as(({ foo }) => <span>{foo}</span>);

  render(<Component foo="bar" />);

  screen.getByText('bar');
});

it('will call is method on creation', () => {
  class Control extends Model {}

  const Test = Control.as(() => null);

  const didCreate = jest.fn();

  const screen = render(<Test is={didCreate} />);

  expect(didCreate).toHaveBeenCalledTimes(1);

  screen.rerender(<Test is={didCreate} />);
  expect(didCreate).toHaveBeenCalledTimes(1);

  act(screen.unmount);
});

it('will pass untracked props to render', async () => {
  class Test extends Model {
    foo = 'foo';

    constructor(...args: Model.Args) {
      super(args);
      test = this;
    }
  }

  let test: Test;
  const Component = Test.as((props: { value: string }, self) => (
    <span>{self.foo + props.value}</span>
  ));

  render(<Component value="bar" />);
  screen.getByText('foobar');

  await act(async () => test.set({ foo: 'baz' }));
  screen.getByText('bazbar');
});

it('will revert to value from prop', async () => {
  class Test extends Model {
    foo = 'foo';

    constructor(...args: Model.Args) {
      super(args);
      test = this;
      this.set(didSetFoo);
    }
  }

  let test: Test;
  const didSetFoo = jest.fn();
  const renderSpy = jest.fn((_, { foo }) => {
    return <span>{foo}</span>;
  });

  const Component = Test.as(renderSpy);

  // Notice that foo is set to "bar" from prop
  // This will always override value on render
  render(<Component foo="bar" />);

  // Expect initial render to be based on prop's value
  screen.getByText('bar');

  await act(async () => {
    // explicitly update foo; calls for new render
    test.foo = 'baz';
    await test.set();
    expect(test.foo).toBe('baz');
  });

  // Should re-render due to update however,
  // is reset to bar by prop before render completes
  screen.getByText('bar');

  expect(didSetFoo).toHaveBeenCalledTimes(2);
  expect(renderSpy).toHaveBeenCalledTimes(2);
});

it('will override method', async () => {
  class Test extends Model {
    callback() {
      return 'foo';
    }
  }

  const Component = Test.as((_, self) => {
    return <span>{self.callback()}</span>;
  });

  const element = render(<Component callback={() => 'bar'} />);
  screen.getByText('bar');

  element.rerender(<Component callback={() => 'baz'} />);
  screen.getByText('baz');
});

it('will trigger set instruction', () => {
  class Foo extends Model {
    value = set('foobar', didSet);
  }

  const Component = Foo.as((_, self) => null);
  const didSet = jest.fn();

  render(<Component value="barfoo" />);

  expect(didSet).toBeCalled();
});

describe('new method', () => {
  it('will call if exists', () => {
    const didCreate = jest.fn();

    class Test extends Model {
      value = 0;

      new() {
        didCreate();
      }
    }

    const Component = Test.as(() => null);

    render(<Component />);

    expect(didCreate).toHaveBeenCalled();
  });

  it('will enforce signature', () => {
    class Test extends Model {
      new(foo: string) {}
    }

    void function test() {
      // @ts-expect-error
      Test.as(() => null);
    };
  });
});

describe('suspense', () => {
  it('will render fallback prop', async () => {
    class Foo extends Model {
      value = set<string>();
    }

    let foo!: Foo;
    const Provider = Foo.as(() => <Consumer />);

    const Consumer = () => (foo = Foo.get()).value;

    const element = render(<Provider fallback={<span>Loading...</span>} />);

    expect(element.getByText('Loading...')).toBeInTheDocument();

    await act(async () => (foo.value = 'Hello World'));

    expect(element.getByText('Hello World')).toBeInTheDocument();
  });

  it('will use fallback property first', async () => {
    class Foo extends Model {
      value = set<string>();
      fallback = (<span>Loading!</span>);
    }

    let foo!: Foo;
    const Provider = Foo.as(() => <Consumer />);

    const Consumer = () => (foo = Foo.get()).value;

    const element = render(<Provider />);

    expect(element.queryByText('Loading!')).toBeInTheDocument();

    element.rerender(<Provider fallback={<span>Loading...</span>} />);

    expect(element.getByText('Loading...')).toBeInTheDocument();

    await act(async () => {
      foo.value = 'Hello World';
    });

    expect(element.getByText('Hello World')).toBeInTheDocument();
  });
});
