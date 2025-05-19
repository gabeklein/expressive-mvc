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
    expect(screen.getByText("bar")).toBeInTheDocument();

    await act(async () => test.set({ foo: "baz" }));

    expect(screen.getByText("baz")).toBeInTheDocument();
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
    const Component = Test.as((props) => <span>{props.foo}</span>);
    const { rerender } = render(<Component foo="bar" />);

    expect(screen.getByText("bar")).toBeInTheDocument();

    rerender(<Component foo="baz" />);

    expect(screen.getByText("baz")).toBeInTheDocument();
    expect(didUpdateFoo).toHaveBeenCalledTimes(1);
    expect(didUpdateFoo).toHaveBeenCalledWith("foo", { foo: "baz" });
  });

  it("will pass untracked props to render", async () => {
    class Test extends Model {
      foo = "foo";
    }
    const Component = Test.as((props: { value: string }, self) => (
      <span>
        {self.foo}
        {props.value}
      </span>
    ));
    let test: Test;
    render(
      <Component
        foo="foo"
        value="bar"
        is={(self) => {
          test = self;
        }}
      />
    );
    expect(screen.getByText("foobar")).toBeInTheDocument();
    await act(async () => test.set({ foo: "baz" }));
    expect(screen.getByText("bazbar")).toBeInTheDocument();
  });
});
