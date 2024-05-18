/** @jsxImportSource ../jsx */

import Model from ".";
import { create } from "react-test-renderer";
import { Consumer } from "./context";

describe("built-in", () => {
  // class Whatever extends Component<{ foo: string }> {
  //   static propTypes?: {
  //     foo: string;
  //   }
  // }

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

  it.only("will render multiple times", () => {
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