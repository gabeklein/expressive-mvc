import { Component } from 'react';
import { create, act } from 'react-test-renderer';

import { Consumer, has, Model, set } from '.';

describe("has instruction", () => {
  it("will callback on register", () => {
    class Child extends Model {
      parents = has(gotParent);
    }
    class Parent extends Model {
      child = has(Child, gotChild);
    }
  
    const didCallback = jest.fn();
    const gotParent = jest.fn(() => didCallback.bind(null, "parent"));
    const gotChild = jest.fn(() => didCallback.bind(null, "child"));

    const rendered = create(
      <Parent>
        <Child />
      </Parent>
    );

    expect(gotParent).toHaveBeenCalledTimes(1);
    expect(gotChild).toHaveBeenCalledTimes(1);

    act(() => rendered.unmount());

    expect(didCallback).toHaveBeenCalledTimes(2);
    expect(didCallback.mock.calls[0][0]).toBe("parent");
    expect(didCallback.mock.calls[1][0]).toBe("child");
  });
})

it("will create and provide instance", () => {
  class Control extends Model {
    foo = "bar";
  }

  const rendered = create(
    <Control>
      <Consumer for={Control}>
        {c => c.foo}
      </Consumer>
    </Control>
  );

  expect(rendered.toJSON()).toBe("bar");
})

it("will create instance only once", () => {
  class Control extends Model {
    constructor(...args: Model.Args){
      super(args);
      didConstruct(this);
    }
  }

  const didConstruct = jest.fn();
  const rendered = create(<Control />);

  expect(didConstruct).toHaveBeenCalledTimes(1);

  rendered.update(<Control />);

  expect(didConstruct).toHaveBeenCalledTimes(1);
})

it("will call is method on creation", () => {
  class Control extends Model {}

  const didCreate = jest.fn(() => didDestroy);
  const didDestroy = jest.fn();

  const rendered = create(<Control is={didCreate} />);

  expect(didCreate).toHaveBeenCalledTimes(1);

  rendered.update(<Control is={didCreate} />);
  expect(didCreate).toHaveBeenCalledTimes(1);

  act(() => rendered.unmount());
  expect(didDestroy).toHaveBeenCalledTimes(1);
})

describe("element props", () => {
  class Foo extends Model {
    /** Hover over this prop to see description. */
    value?: string = undefined;
  }

  it("will accept managed values", () => {
    create(
      <Foo value="baz">
        <Consumer for={Foo}>
          {c => expect(c.value).toBe("baz")}
        </Consumer>
      </Foo>
    );
  });

  it("will assign values to instance", () => {
    create(
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

    create(
      <Foo value="barfoo">
        <Consumer for={Foo}>
          {i => {
            expect(i.value).toBe("barfoo");
          }}
        </Consumer>
      </Foo>
    );

    expect(didSet).toBeCalled();
  })
  
  it("will not assign foreign values", () => {
    create(
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
  })
})

describe("element children", () => {
  it("will handle multiple elements", () => {
    class Control extends Model {
      foo = "bar"
    }
  
    const rendered = create(
      <Control foo='sd'>
        <>Hello</>
        <>World</>
      </Control>
    );
  
    expect(rendered.toJSON()).toEqual(["Hello", "World"]);
  })

  it("will notify parent", async () => {
    class Control extends Model {
      children = set<React.ReactNode>(undefined, didUpdate);
    }

    const didUpdate = jest.fn();
    const rendered = create(
      <Control >
        Hello
      </Control>
    );
  
    expect(rendered.toJSON()).toBe("Hello");
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
  
    const rendered = create(
      <Control>
        {symbol}
      </Control>
    );
  
    expect(rendered.toJSON()).toEqual("Hello");
  })
})

describe("render method", () => {
  it("will be element output", () => {
    class Control extends Model {
      foo = "bar";
  
      render(props: { bar: string }) {
        return <>{props.bar}{this.foo}</>;
      }
    }
  
    const rendered = create(
      <Control bar='foo' />
    );
  
    expect(rendered.toJSON()).toEqual(["foo", "bar"]);
  })
  
  it("will ignore children not handled", () => {
    class Control extends Model {
      render(props: { value: string }) {
        return <>{props.value}</>;
      }
    }
  
    const rendered = create(
      // while by default children are passed through,
      // we shouldn't accept props not defined in render
      // @ts-expect-error
      <Control value='Goodbye'>
        Hello
      </Control>
    );
  
    expect(rendered.toJSON()).toEqual("Goodbye");
  })
  
  it("will handle children if managed by this", () => {
    class Control extends Model {
      children = set<React.ReactNode>();
  
      render(props: { value: string }) {
        return <>{props.value}{this.children}</>;
      }
    }
  
    const rendered = create(
      <Control value='Hello'>
        World
      </Control>
    );
  
    expect(rendered.toJSON()).toEqual(["Hello", "World"]);
  })

  it("will use render prop if defined", () => {
    class Control extends Model {
      value = "bar";
    }

    const rendered = create(
      <Control render={() => "bar"} />
    );

    expect(rendered.toJSON()).toEqual("bar");
  });

  it("will refresh on update", async () => {
    class Control extends Model {
      value = "bar";

      render(props: {}, self: this){
        return self.value;
      }
    }

    let control: Control;
    const rendered = create(
      <Control is={x => {control = x}} />
    );

    expect(rendered.toJSON()).toEqual("bar");

    await act(() => {
      control.set({ value: "foo" });
    });

    expect(rendered.toJSON()).toEqual("foo");
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
    
    const render = create(
      <FunctionComponent foo="bar" />
    );
    
    expect(render.toJSON()).toMatchInlineSnapshot(`
      <div>
        Hello 
        bar
      </div>
    `);

    const render2 = create(
      <ClassComponent bar="baz" />
    );

    expect(render2.toJSON()).toMatchInlineSnapshot(`
      <div>
        Hello 
        baz
      </div>
    `);
  });
})