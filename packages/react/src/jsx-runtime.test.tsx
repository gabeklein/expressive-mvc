import { create } from 'react-test-renderer';

import Model from '.';
import { Consumer } from './context';
import { Component } from 'react';

it("will create new instance", () => {
  class Control extends Model {
    foo = "bar";
  }

  create(
    <Control>
      <Consumer for={Control}>
        {c => expect(c.foo).toBe("bar")}
      </Consumer>
    </Control>
  );
})

it("will accept props", () => {
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

it("will accept render function as child", () => {
  class Control extends Model {
    /** Hover over this prop to see description. */
    foo = "bar";
  }

  const rendered = create(
    <Control foo="baz">
      {c => c.foo}
    </Control>
  );

  expect(rendered.toJSON()).toBe("baz");
});

it("will handle jsxs for coverage", () => {
  class Control extends Model {
    foo = "bar"
  }

  create(
    <Control foo='sd'>
      <div />
      <div />
    </Control>
  );
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