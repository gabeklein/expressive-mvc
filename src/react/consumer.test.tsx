import React from 'react';

import { render } from '../../tests/adapter';
import { Model } from '../model';
import { Consumer } from './consumer';
import { MVC } from './mvc';
import { Provider } from './provider';
import { Oops } from './useLocal';

class Foo extends MVC {
  value?: string = undefined;
}
class Bar extends MVC {}
class Baz extends Bar {}

it("will handle complex arrangement", () => {
  const instance = Foo.create();

  render(
    <Provider of={instance}>
      <Provider of={Baz}>
        <Provider of={{ Bar }}>
          <Consumer of={Foo} get={i => expect(i).toBe(instance)} />
          <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Bar)} />
          <Consumer of={Baz} get={i => expect(i).toBeInstanceOf(Baz)} />
        </Provider>
      </Provider>
    </Provider>
  )
})

it("will render with instance for child-function", async () => {
  class Test extends Model {
    value = "foobar";
  }

  const instance = Test.create();
  const didRender = jest.fn();

  function onRender(instance: Test){
    const { value } = instance;
    didRender(value);
    return <span>{value}</span>;
  }

  render(
    <Provider of={instance}>
      <Consumer of={Test}>
        {onRender}
      </Consumer>
    </Provider>
  )

  expect(didRender).toBeCalledWith("foobar");
})

it("will throw if expected-prop missing", () => {
  const instance = Foo.create();
  const attempt = () => render(
    <Provider of={instance}>
      { /* @ts-ignore */}
      <Consumer of={Foo} />
    </Provider>
  );

  expect(attempt).toThrowError();
})

it("will pass undefined if not found for get-prop", () => {
  render(
    <Consumer of={Bar} get={i => expect(i).toBeUndefined()} />
  )
})

it("will throw if not found where required", () => {
  const test = () => render(
    <Consumer of={Bar} has={i => void i} />
  )

  expect(test).toThrowError(
    Oops.NothingInContext(Bar.name)
  );
})

it("will eagerly select extended class", () => {
  render(
    <Provider of={Baz}>
      <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Baz)} />
    </Provider>
  )
})

it("will select closest instance of same type", () => {
  render(
    <Provider of={Foo} value="outer">
      <Provider of={Foo} value="inner">
        <Consumer of={Foo} has={i => expect(i.value).toBe("inner")} />
      </Provider>
    </Provider>
  )
});

it("will select closest match over best match", () => {
  render(
    <Provider of={Bar}>
      <Provider of={Baz}>
        <Consumer of={Bar} get={i => expect(i).toBeInstanceOf(Baz)} />
      </Provider>
    </Provider>
  )
})