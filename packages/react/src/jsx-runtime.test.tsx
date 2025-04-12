import { act, Component } from 'react';
import { create } from 'react-test-renderer';

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
  it("will accept function", () => {
    class Control extends Model {
      /** Hover over this prop to see description. */
      foo = "bar";
    }
  
    const rendered = create(
      <Control foo="baz">
        {c => c.foo}
      </Control>
    );
  
    expect(rendered.toJSON()).toBe("baz")
  });

  it("will self-update function", async () => {
    class Control extends Model {
      constructor(...args: Model.Args){
        super(args);
        control = this;
      }
  
      /** Hover over this prop to see description. */
      foo = "bar";
    }
  
    let control!: Control;
  
    const rendered = create(
      <Control foo="baz">
        {c => c.foo}
      </Control>
    );
  
    expect(rendered.toJSON()).toBe("baz");
  
    await act(async () => control.set({ foo: "qux" }));
  
    expect(rendered.toJSON()).toBe("qux");
  });

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
})

describe("children property", () => {
  it("will pass through without render method", () => {
    class Control extends Model {
      children = <>Hello</>;
    }
  
    const rendered = create(<Control />);
  
    expect(rendered.toJSON()).toBe("Hello");
  })

  it("will notify parent", async () => {
    class Control extends Model {
      children = set<React.ReactNode>(undefined, didUpdate);
    }

    const didUpdate = jest.fn();
    const rendered = create(
      <Control>
        Hello
      </Control>
    );
  
    expect(rendered.toJSON()).toBe("Hello");
    expect(didUpdate).toHaveBeenCalled();
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
})

it.skip("will render multiple times", () => {
  class Control extends Model {
    /** Hello this is bar */
    foo = "bar";
  }

  const render = create(
    <Control >
      <Consumer for={Control}>
        {c => expect(c).toBeInstanceOf(Control)}
      </Consumer>
    </Control>
  );

  render.update(
    <Control foo='sdas'>
      <Consumer for={Control}>
        {control => {
          debugger
        }}
      </Consumer>
    </Control>
  )
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
  })
})