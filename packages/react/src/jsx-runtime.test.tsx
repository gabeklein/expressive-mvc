import { create } from 'react-test-renderer';

import Model from '.';
import { Consumer } from './context';

describe("built-in", () => {
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

  it("will handle jsxs for coverage", () => {
    class Control extends Model {}

    create(
      <Control>
        <div />
        <div />
      </Control>
    );
  })

  it.skip("will render multiple times", () => {
    class Control extends Model {
      foo = "bar";
    }

    const render = create(
      <Control>
        <Consumer for={Control}>
          {c => expect(c).toBeInstanceOf(Control)}
        </Consumer>
      </Control>
    );

    render.update(
      <Control>
        <Consumer for={Control}>
          {control => {
            debugger
          }}
        </Consumer>
      </Control>
    )
  })
})