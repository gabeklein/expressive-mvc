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

  let test: Test;

  const Component = Test.as((_, own) => <>{own.foo}</>);
  const rendered = create(<Component />);

  expect(rendered.toJSON()).toEqual("bar");

  await act(() => {
    test!.foo = "baz";
  })

  rendered.update(<Component />);

  expect(rendered.toJSON()).toEqual("baz");
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

  const Component = Test.as((_, own) => <>{own.foo}</>)
  const rendered = create(<Component foo="bar" />);

  expect(rendered.toJSON()).toEqual("bar");

  rendered.update(<Component foo="baz" />);

  expect(rendered.toJSON()).toEqual("baz");

  expect(didUpdateFoo).toHaveBeenCalledTimes(1);
  expect(didUpdateFoo).toHaveBeenCalledWith("foo", { foo: "baz" });
});

it("will pass untracked props to render", () => {
  class Test extends Model {
    /** This is foo */
    foo = "foo";
  }

  interface TestProps {
    /** This is bar */
    value: string;
  }

  const Component = Test.as((props: TestProps, own) => (
    <>{props.value}{own.foo}</>
  ))

  const rendered = create(
    <Component foo="foo" value="foobar" />
  );

  expect(rendered.toJSON()).toEqual(["foobar", "foo"]);
});