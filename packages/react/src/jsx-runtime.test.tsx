/** @jsxImportSource . */

import { act, render, screen } from '@testing-library/react';
import { Children, Component, isValidElement } from 'react';
import { Consumer, get, has, Model, set } from '.';

describe("has instruction", () => {
  it("will callback on register", () => {
    class Parent extends Model {
      child = has(Child, gotChild);
    }

    class Child extends Model {
      parents = has(gotParent);
    }
  
    const didCallback = jest.fn();
    const gotParent = jest.fn(() => didCallback.bind(null, "parent"));
    const gotChild = jest.fn(() => didCallback.bind(null, "child"));

    const { unmount } = render(
      <Parent>
        <Child />
      </Parent>
    );

    expect(gotParent).toHaveBeenCalledTimes(1);
    expect(gotChild).toHaveBeenCalledTimes(1);

    unmount();

    expect(didCallback).toHaveBeenCalledTimes(2);
    expect(didCallback.mock.calls[0][0]).toBe("parent");
    expect(didCallback.mock.calls[1][0]).toBe("child");
  });
})

it("will create and provide instance", () => {
  class Control extends Model {
    foo = "bar";
  }

  render(
    <Control>
      <Consumer for={Control}>
        {c => c.foo}
      </Consumer>
    </Control>
  );

  screen.getByText("bar");
})

it("will create instance only once", () => {
  class Control extends Model {
    constructor(...args: Model.Args){
      super(args);
      didConstruct(this);
    }
  }

  const didConstruct = jest.fn();
  const { rerender } = render(<Control />);

  expect(didConstruct).toHaveBeenCalledTimes(1);

  rerender(<Control />);

  expect(didConstruct).toHaveBeenCalledTimes(1);
})

it("will call is method on creation", () => {
  class Control extends Model {}

  const didCreate = jest.fn(() => didDestroy);
  const didDestroy = jest.fn();

  const screen = render(<Control is={didCreate} />);

  expect(didCreate).toHaveBeenCalledTimes(1);

  screen.rerender(<Control is={didCreate} />);
  expect(didCreate).toHaveBeenCalledTimes(1);

  act(screen.unmount);
  expect(didDestroy).toHaveBeenCalledTimes(1);
})

describe("element props", () => {
  class Foo extends Model {
    /** Hover over this prop to see description. */
    value?: string = undefined;
  }

  it("will accept managed values", () => {
    render(
      <Foo value="baz">
        <Consumer for={Foo}>
          {c => expect(c.value).toBe("baz")}
        </Consumer>
      </Foo>
    );
  });

  it("will assign values to instance", () => {
    render(
      <Foo value="foobar">
        <Consumer for={Foo}>
          {i => expect(i.value).toBe("foobar")}
        </Consumer>
      </Foo>
    );
  })

  it("will trigger set instruction", () => {
    class Foo extends Model {
      value = set("foobar", didSet);
    }

    const didSet = jest.fn();

    render(<Foo value="barfoo" />);

    expect(didSet).toBeCalled();
  })

  it("will override method", async () => {
    class Test extends Model {
      callback(){
        return "foo";
      }

      render(){
        return <span>{this.callback()}</span>;
      }
    }

    const element = render(<Test callback={() => "bar"} />);
    screen.getByText("bar");

    element.rerender(<Test callback={() => "baz"} />);
    screen.getByText("baz");
  });

  it("will not assign foreign values", () => {
    render(
      // @ts-expect-error
      <Foo nonValue="foobar">
        <Consumer for={Foo}>
          {i => {
            // @ts-expect-error
            expect(i.nonValue).toBeUndefined();
          }}
        </Consumer>
      </Foo>
    );
  });
})

describe("element children", () => {
  it("will handle multiple elements", () => {
    class Control extends Model {
      foo = "bar"
    }
  
    const screen = render(
      <Control foo='sd'>
        <span>Hello</span>
        <span>World</span>
      </Control>
    );
  
    screen.getByText("Hello");
    screen.getByText("World");
  })

  it("will notify parent", async () => {
    class Control extends Model {
      children = set<React.ReactNode>(undefined, didUpdate);
    }

    const didUpdate = jest.fn();
    const screen = render(
      <Control>
        Hello
      </Control>
    );
  
    screen.getByText("Hello");
    expect(didUpdate).toHaveBeenCalled();
  })

  it("will accept arbitrary children with render", () => {
    const symbol = Symbol("foo");
    
    class Control extends Model {
      render(props: { children: symbol }) {
        expect(props.children).toBe(symbol);
        return "Hello";
      }
    }
  
    const screen = render(
      <Control>
        {symbol}
      </Control>
    );
  
    screen.getByText("Hello");
  })
})

describe("render method", () => {
  it("will be element output", () => {
    class Control extends Model {
      foo = "bar";
  
      render(props: { bar: string }) {
        return (
          <>
            <span>{props.bar}</span>
            <span>{this.foo}</span>
          </>
        );
      }
    }
  
    const screen = render(
      <Control bar='foo' />
    );
  
    screen.getByText("foo");
    screen.getByText("bar");
  })

  it("will accept function component", async () => {
    const FunctionComponent = (props: { name: string }, self: ClassComponent) => {
      return <div>{self.salutation} {props.name}</div>;
    };
    
    class ClassComponent extends Model {
      salutation = "Hello";
      render = FunctionComponent;
    }

    const screen = render(
      <ClassComponent name="World" />
    );

    screen.getByText("Hello World");

    screen.rerender(
      <ClassComponent salutation='Bonjour' name="React" />
    );

    screen.getByText("Bonjour React");
  });
  
  it("will ignore children not handled", () => {
    class Control extends Model {
      render(props: { value: string }) {
        return <>{props.value}</>;
      }
    }
  
    const screen = render(
      // while by default children are passed through,
      // we shouldn't accept props not defined in render
      // @ts-expect-error
      <Control value='Goodbye'>
        Hello
      </Control>
    );
  
    // getByText throws if element not found, so this is sufficient
    screen.getByText("Goodbye");
    // or use queryByText with null check for absence
    expect(screen.queryByText("Hello")).toBe(null);
  })
  
  it("will handle children if managed by this", () => {
    class Control extends Model {
      children = set<React.ReactNode>();
  
      render(props: { value: string }) {
        // return <>{props.value}{this.children}</>;
        return (
          <>
            <span>{props.value}</span>
            {this.children}
          </>
        )
      }
    }
  
    const screen = render(
      <Control value='Hello'>
        World
      </Control>
    );
  
    screen.getByText("Hello");
    screen.getByText("World");
  })

  it("will use render prop if defined", () => {
    class Control extends Model {
      value = "bar";
    }

    const screen = render(
      <Control render={() => "bar"} />
    );

    screen.getByText("bar");
  });

  it("will refresh on update", async () => {
    class Control extends Model {
      value = "bar";

      constructor(...args: Model.Args){
        super(args);
        control = this;
      }

      render(){
        return (
          <span>{this.value}</span>
        );
      }
    }

    let control: Control;
    const screen = render(<Control />);

    screen.getByText("bar");

    await act(async () => control.set({ value: "foo" }));

    screen.getByText("foo");
  })

  it("will not pass is prop", () => {
    class Invalid extends Model {
      render(props: { is: "hello" }) {
        return null;
      }
    }

    // @ts-expect-error
    void <Invalid />;

    class Test extends Model {
      render(props: { is?: "hello" }) {
        expect("is" in props).toBeFalsy();
        return null;
      }
    }

    const callback = jest.fn();

    render(<Test is={callback} />);

    expect(callback).toHaveBeenCalledTimes(1);
  })
})

describe("Model.FC", () => {
  it("will have correct types", () => {
    class Control extends Model {
      foo = "bar";
      bar = "baz";
    }
  
    interface CorrectProps {
      baz: string;
      foo?: string | undefined
      bar?: string | undefined
      is?: ((instance: Control) => void | (() => void)) | undefined;
    }
  
    const Component: Model.FC<Control, { baz: string }> = (props) => {
      expect<CorrectProps>(props);
      return <div>{props.baz}</div>;
    };
  
    expect<(props: CorrectProps) => React.ReactNode>(Component);
  })
})

describe("types", () => {
  it("will not compromise existing Component props", () => {
    const FunctionComponent = (props: {
      /** this is foo */
      foo: string
    }) => {
      return <div>Hello {props.foo}</div>;
    };
    
    class ClassComponent extends Component {
      readonly props!: {
        /** this is bar */
        bar: string;
      };
      
      render() {
        return <div>Hello {this.props.bar}</div>;
      }
    }
    
    const screen = render(
      <FunctionComponent foo="bar" />
    );
    
    screen.getByText("Hello bar");

    screen.rerender(
      <ClassComponent bar="baz" />
    );

    screen.getByText("Hello baz");
  });
})

describe.skip("implicit context", () => {
  it("will provide automatically", async () => {
    class Parent extends Model {
      value = "foobar";
    }
    class Child extends Model {
      parent = get(Parent);
    }

    let parent: Parent;
    const Outer = (props: React.PropsWithChildren) => {
      parent = Parent.use().is;
      return props.children;
    }

    const Inner = () => {
      return Child.use().parent.value;
    }

    render(
      <Outer>
        <Inner />
      </Outer>
    );

    screen.getByText("foobar");

    await act(async () => parent.set({ value: "barfoo" }));

    screen.getByText("barfoo");
  })

  it("will recycle context", () => {
    class Foo extends Model {};
    class Bar extends Model {};
    class Baz extends Model {
      foo = get(Foo);
      bar = get(Bar);

      constructor(...args: Model.Args){
        super(args);
        baz = this;
      }
    }

    let baz!: Baz;
    const Outer = (props: React.PropsWithChildren) => {
      Foo.use();
      Bar.use();

      return props.children;
    }

    render(
      <Outer>
        <Baz />
      </Outer>
    );
    
    expect(baz.foo).toBeInstanceOf(Foo);
    expect(baz.bar).toBeInstanceOf(Bar);
  })
})

describe.skip("implicit return", () => {
  it("will return element", () => {
    const Test = (props: { name?: string }) => {
      <div>Hello {props.name || "World"}</div>
    }

    const element = render(<Test />);
    screen.getByText("Hello World");

    element.rerender(<Test name="Foo" />);
    screen.getByText("Hello Foo");
  });

  it("will select last element", () => {
    const Test = (props: { hi?: boolean }) => {
      if(props.hi)
        <div>
          <span>Hello</span>
          <span>World</span>
        </div>;
      else
        <div>Goodbye World</div>;
    }

    const element = render(<Test />);
    screen.getByText("Goodbye World");

    element.rerender(<Test hi />);
    screen.getByText("Hello");
    screen.getByText("World");
  })

  it("will always select returned", () => {
    const Test = (props: { hi?: boolean }) => {
      const hi = <span>Hello World</span>;
      const bye = <div>Goodbye World</div>;

      return props.hi ? hi : bye;
    }

    render(<Test hi />);
    screen.getByText("Hello World");
  })

  it("will ignore non-arrow functions", () => {
    const Container = (props: { children: React.ReactNode }) => {
      const [
        child1,
        child2,
        child3
      ] = Children.toArray(props.children);

      // Runtime wraps arrow functions in an HOC so should be different.
      expect(isValidElement(child1) && child1.type !== ArrowFunction).toBe(true);

      // function expressions and declarations are not wrapped.
      expect(isValidElement(child2) && child2.type === FunctionExpression).toBe(true);
      expect(isValidElement(child3) && child3.type === FunctionDeclaration).toBe(true);

      return null;
    }

    const ArrowFunction = () => null;
    const FunctionExpression = function() {
      return null;
    }
    function FunctionDeclaration() {
      return null;
    }

    render(
      <Container>
        <ArrowFunction />
        <FunctionExpression />
        <FunctionDeclaration />
      </Container>
    )
  });
})