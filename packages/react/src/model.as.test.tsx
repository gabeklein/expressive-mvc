import { act, render, screen } from '@testing-library/react';

import Model from '.';

describe("model.as", () => {
  it("will update component as values change", async () => {
    class Test extends Model {
      foo = "bar";
      constructor() {
        super();
        test = this;
      }
    }
    let test: Test;
    const Component = Test.as((_, self) => <span>{self.foo}</span>);

    render(<Component />);
    screen.getByText("bar");

    await act(async () => test.set({ foo: "baz" }));

    screen.getByText("baz");
  });

  it("will not create abstract Model", () => {
    // @ts-expect-error
    const attempt = () => Model.as(() => null);
    expect(attempt).toThrowError();
  });

  it("will pass props to model", async () => {
    const didUpdateFoo = jest.fn();
    class Test extends Model {
      foo = "foo";
      constructor(...args: Model.Args) {
        super(...args);
        this.set(didUpdateFoo);
      }
    }
    const Component = Test.as(({ foo }) => <span>{foo}</span>);
    const { rerender } = render(<Component foo="bar" />);

    screen.getByText("bar");
    expect(didUpdateFoo).toHaveBeenCalledTimes(1);
    expect(didUpdateFoo).toHaveBeenCalledWith("foo", { foo: "bar" });

    rerender(<Component foo="baz" />);

    screen.getByText("baz");
    expect(didUpdateFoo).toHaveBeenCalledTimes(2);
    expect(didUpdateFoo).toHaveBeenCalledWith("foo", { foo: "baz" });
  });

  it("will pass untracked props to render", async () => {
    class Test extends Model {
      foo = "foo";

      constructor(...args: Model.Args) {
        super(args);
        test = this;
      }
    }

    let test: Test;
    const Component = Test.as((props: { value: string }, self) => (
      <span>
        {self.foo + props.value}
      </span>
    ));

    render(<Component value="bar" />);
    screen.getByText("foobar");

    await act(async () => test.set({ foo: "baz" }));
    screen.getByText("bazbar");
  });

  it("will revert to value from prop", async () => {
    class Test extends Model {
      foo = "foo";

      constructor(...args: Model.Args) {
        super(args);
        test = this;
        this.set(didSetFoo);
      }
    }

    let test: Test;
    const didSetFoo = jest.fn();
    const didRender = jest.fn();

    const Component = Test.as((_, self) => {
      didRender();
      return <span>{self.foo} </span>;
    });

    render(<Component foo='bar' />);
    screen.getByText("bar");

    await act(async () => {
      await test.set({ foo: "baz" });
      expect(test.foo).toBe("baz");
    });

    // is reset to bar by prop before render completes
    screen.getByText("bar");

    expect(didSetFoo).toHaveBeenCalledTimes(3);
    expect(didRender).toHaveBeenCalledTimes(2);
  });
});
