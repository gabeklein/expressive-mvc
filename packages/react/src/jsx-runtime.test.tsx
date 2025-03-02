import { create } from 'react-test-renderer';

import { Model, set } from '.';
import { Consumer } from './context';
import { act, Component } from 'react';

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

it("will accept managed values as props", () => {
  class Control extends Model {
    /** Hover over this prop to see description. */
    foo = "bar";
  }

  create(
    <Control foo="baz">
      <Consumer for={Control}>
        {c => expect(c.foo).toBe("baz")}
      </Consumer>
    </Control>
  );
});

describe("children", () => {
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

  it("will handle multiple functions", () => {
    class Control extends Model {
      foo = "bar";
      baz = "qux";
    }
  
    const rendered = create(
      <Control>
        {c => c.foo}
        {c => c.baz}
      </Control>
    );
  
    expect(rendered.toJSON()).toEqual(["bar", "qux"]);
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
  
  it("will mix elements and functions", () => {
    class Control extends Model {
      count = 42;
    }
  
    const rendered = create(
      <Control>
        <div>Static content</div>
        {c => `Count: ${c.count}`}
        <span>More content</span>
      </Control>
    );
  
    expect(rendered.toJSON()).toMatchInlineSnapshot(`
      Array [
        <div>
          Static content
        </div>,
        "Count: 42",
        <span>
          More content
        </span>,
      ]
    `);
  });
  
  // TODO: do I need this test?
  it("will handle functions returning complex elements", () => {
    class Control extends Model {
      items = ["apple", "banana", "cherry"];
    }
  
    const rendered = create(
      <Control>
        {c => (
          <ul>
            {c.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        )}
      </Control>
    );
  
    expect(rendered.toJSON()).toMatchInlineSnapshot(`
      <ul>
        <li>
          apple
        </li>
        <li>
          banana
        </li>
        <li>
          cherry
        </li>
      </ul>
    `);
  });
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