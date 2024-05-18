import { act, create } from 'react-test-renderer';

import Model from '.';

it("will update component as values change", async () => {
  class Test extends Model {
    foo = "bar";

    constructor(){
      super();
      test = this;
    }
  }

  const Component = Test.as(props => (
    <span>{props.foo}</span>
  ))

  let test: Test;
  const rendered = create(<Component />);

  expect(rendered.toJSON()).toEqual({
    type: "span",
    props: {},
    children: ["bar"]
  });

  await act(() => {
    test!.foo = "baz";
  })

  rendered.update(<Component />);

  expect(rendered.toJSON()).toEqual({
    type: "span",
    props: {},
    children: ["baz"]
  });
});

it("will not create abstract Model", () => {
  // @ts-expect-error
  const attempt = () => Model.as(() => null);

  expect(attempt).toThrowError();
});

it("will pass props to model", () => {
  const didUpdateFoo = jest.fn();
  
  class Test extends Model {
    foo = "foo";

    constructor(...args: Model.Args){
      super(...args);
      this.set(didUpdateFoo);
    }
  }

  const Component = Test.as(props => (
    <span>{props.foo}</span>
  ))

  const rendered = create(<Component foo="bar" />);

  expect(rendered.toJSON()).toEqual({
    type: "span",
    props: {},
    children: ["bar"]
  });

  rendered.update(<Component foo="baz" />);

  expect(rendered.toJSON()).toEqual({
    type: "span",
    props: {},
    children: ["baz"]
  });

  expect(didUpdateFoo).toHaveBeenCalledTimes(1);
  expect(didUpdateFoo).toHaveBeenCalledWith("foo", { foo: "baz" });
});

it("will pass untracked props to render", () => {
  class Test extends Model {
    foo = "foo";
  }

  const Component = Test.as((props: { value: string }) => (
    <span>{props.value}</span>
  ))

  const rendered = create(
    <Component foo="foo" value="foobar" />
  );

  expect(rendered.toJSON()).toEqual({
    type: "span",
    props: {},
    children: ["foobar"]
  });
});