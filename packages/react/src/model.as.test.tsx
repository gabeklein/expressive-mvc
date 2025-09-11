import { act, render, screen } from '@testing-library/react';

import Model from '.';
import { set } from '@expressive/mvc';

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

it("will pass props before effects run", async () => {
  class Test extends Model {
    foo = "foo";

    constructor(...args: Model.Args) {
      super(...args, self => {
        expect(self.foo).toBe("bar");
      });
    }
  }

  const Component = Test.as(({ foo }) => <span>{foo}</span>);

  render(<Component foo="bar" />);

  screen.getByText("bar");
});

it("will call is method on creation", () => {
  class Control extends Model {}

  const Test = Control.as(() => null);

  const didCreate = jest.fn(() => didDestroy);
  const didDestroy = jest.fn();

  const screen = render(<Test is={didCreate} />);

  expect(didCreate).toHaveBeenCalledTimes(1);

  screen.rerender(<Test is={didCreate} />);
  expect(didCreate).toHaveBeenCalledTimes(1);

  act(screen.unmount);
  expect(didDestroy).toHaveBeenCalledTimes(1);
})

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

it("will override method", async () => {
  class Test extends Model {
    callback(){
      return "foo";
    }
  }

  const Component = Test.as((_, self) => {
    return <span>{self.callback()}</span>;
  });

  const element = render(<Component callback={() => "bar"} />);
  screen.getByText("bar");

  element.rerender(<Component callback={() => "baz"} />);
  screen.getByText("baz");
});

it("will trigger set instruction", () => {
  class Foo extends Model {
    value = set("foobar", didSet);
  }

  const Component = Foo.as((_, self) => null);
  const didSet = jest.fn();

  render(<Component value="barfoo" />);

  expect(didSet).toBeCalled();
})