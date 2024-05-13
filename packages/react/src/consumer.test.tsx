import React from 'react';
import { create } from 'react-test-renderer';

import Model, { Consumer, Provider } from '.';

const error = jest
  .spyOn(console, "error")
  .mockImplementation(() => {});

afterAll(() => {
  error.mockReset();
});

class Foo extends Model {
  value?: string = undefined;
}
class Bar extends Model {}
class Baz extends Bar {}

it("will handle complex arrangement", () => {
  const instance = Foo.new();

  create(
    <Provider for={instance}>
      <Provider for={Baz}>
        <Provider for={{ Bar }}>
          <Consumer for={Foo}>
            {({ is }) => expect(is).toBe(instance)}
          </Consumer>
          <Consumer for={Bar}>
            {i => expect(i).toBeInstanceOf(Bar)}
          </Consumer>
          <Consumer for={Baz}>
            {i => expect(i).toBeInstanceOf(Baz)}
          </Consumer>
        </Provider>
      </Provider>
    </Provider>
  )
})

it("will render with instance for child-function", async () => {
  class Test extends Model {
    value = "foo";
  }

  const instance = Test.new();
  const didRender = jest.fn();

  function onRender(instance: Test){
    const { value } = instance;
    didRender(value);
    return <span>{value}</span>;
  }

  const result = create(
    <Provider for={instance}>
      <Consumer for={Test}>
        {onRender}
      </Consumer>
    </Provider>
  )

  expect(didRender).toBeCalledWith("foo");
  expect(result.toJSON()).toEqual({
    type: "span",
    props: {},
    children: ["foo"]
  });
  
  instance.value = "bar";
  await instance.set();

  expect(didRender).toBeCalledWith("bar");
  expect(result.toJSON()).toEqual({
    type: "span",
    props: {},
    children: ["bar"]
  });
})

it("will throw if not found where required", () => {
  const test = () => create(
    <Consumer for={Bar}>
      {i => void i}
    </Consumer>
  )

  expect(test).toThrowError("Could not find Bar in context.");
})

it("will eagerly select extended class", () => {
  create(
    <Provider for={Baz}>
      <Consumer for={Bar}>
        {i => expect(i).toBeInstanceOf(Baz)}
      </Consumer>
    </Provider>
  )
})

it("will select closest instance of same type", () => {
  create(
    <Provider for={Foo} set={{ value: "outer" }}>
      <Provider for={Foo} set={{ value: "inner" }}>
        <Consumer for={Foo}>
          {i => expect(i.value).toBe("inner")}
        </Consumer>
      </Provider>
    </Provider>
  )
});

it("will select closest match over best match", () => {
  create(
    <Provider for={Bar}>
      <Provider for={Baz}>
        <Consumer for={Bar}>
          {i => expect(i).toBeInstanceOf(Baz)}
        </Consumer>
      </Provider>
    </Provider>
  )
})