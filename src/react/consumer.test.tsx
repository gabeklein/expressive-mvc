import React from 'react';

import { render } from '../../tests/adapter';
import { Consumer } from './consumer';
import { Oops } from './context';
import { MVC } from './mvc';
import { Provider } from './provider';

class Foo extends MVC {
  value?: string = undefined;
}
class Bar extends MVC {}
class Baz extends Bar {}

it("will handle complex arrangement", () => {
  const instance = Foo.new();

  render(
    <Provider for={instance}>
      <Provider for={Baz}>
        <Provider for={{ Bar }}>
          <Consumer for={Foo} get={i => expect(i).toBe(instance)} />
          <Consumer for={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
          <Consumer for={Baz} get={i => expect(i).toBeInstanceOf(Baz)} />
        </Provider>
      </Provider>
    </Provider>
  )
})

it("will render with instance for child-function", async () => {
  class Test extends MVC {
    value = "foobar";
  }

  const instance = Test.new();
  const didRender = jest.fn();

  function onRender(instance: Test){
    const { value } = instance;
    didRender(value);
    return <span>{value}</span>;
  }

  render(
    <Provider for={instance}>
      <Consumer for={Test}>
        {onRender}
      </Consumer>
    </Provider>
  )

  expect(didRender).toBeCalledWith("foobar");
})

it("will throw if expected-prop missing", () => {
  const instance = Foo.new();
  const attempt = () => render(
    <Provider for={instance}>
      { /* @ts-ignore */}
      <Consumer for={Foo} />
    </Provider>
  );

  expect(attempt).toThrowError();
})

it("will pass undefined if not found for get-prop", () => {
  render(
    <Consumer for={Bar} get={i => expect(i).toBeUndefined()} />
  )
})

it("will throw if not found where required", () => {
  const test = () => render(
    <Consumer for={Bar} has={i => void i} />
  )

  expect(test).toThrowError(
    Oops.NotFound(Bar.name)
  );
})

it("will eagerly select extended class", () => {
  render(
    <Provider for={Baz}>
      <Consumer for={Bar} get={i => expect(i).toBeInstanceOf(Baz)} />
    </Provider>
  )
})

it("will select closest instance of same type", () => {
  render(
    <Provider for={Foo} value="outer">
      <Provider for={Foo} value="inner">
        <Consumer for={Foo} has={i => expect(i.value).toBe("inner")} />
      </Provider>
    </Provider>
  )
});

it("will select closest match over best match", () => {
  render(
    <Provider for={Bar}>
      <Provider for={Baz}>
        <Consumer for={Bar} get={i => expect(i).toBeInstanceOf(Baz)} />
      </Provider>
    </Provider>
  )
})