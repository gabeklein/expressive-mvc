import React from 'react';
import { create } from 'react-test-renderer';

import { Consumer, Controller, Issue, Provider, Singleton, tap } from './adapter';

class Foo extends Controller {
  value?: string = undefined;
}
class Bar extends Controller {}
class Baz extends Bar {}

describe("Provider", () => {
  it("provides an existing instance of controller", () => {
    const instance = Foo.create();

    create(
      <Provider of={instance}>
        <Consumer of={Foo} got={i => expect(i).toStrictEqual(instance)} />
      </Provider>
    );
  })

  it("creates an instance of controller class", () => {
    create(
      <Provider of={Foo}>
        <Consumer of={Foo} got={i => expect(i).toBeInstanceOf(Foo)} />
      </Provider>
    );
  })

  it("merges props into controller", () => {
    create(
      <Provider of={Foo} value="foobar">
        <Consumer of={Foo} got={instance => {
          expect(instance.value).toStrictEqual("foobar");
        }} />
      </Provider>
    );
  })

  it("creates multiple instances via MultiProvider", () => {
    create(
      <Provider of={{ Foo, Bar }}>
        <Consumer of={Foo} got={i => expect(i).toBeInstanceOf(Foo)} />
        <Consumer of={Bar} got={i => expect(i).toBeInstanceOf(Bar)} />
      </Provider>
    )
  })

  it("will destroy created instance when unmounts", async () => {
    const didUnmount = jest.fn();

    const render = create(
      <Provider of={Foo}>
        <Consumer of={Foo} got={instance => {
          instance.willDestroy = didUnmount;
        }} />
      </Provider>
    );

    render.unmount();

    expect(didUnmount).toHaveBeenCalled()
  });
})

describe("Consumer", () => {
  it("can handle complex arrangement", () => {
    const instance = Foo.create();

    create(
      <Provider of={instance}>
        <Provider of={Baz}>
          <Provider of={{ Bar }}>
            <Consumer of={Foo} got={i => expect(i).toStrictEqual(instance)} />
            <Consumer of={Bar} got={i => expect(i).toBeInstanceOf(Bar)} />
            <Consumer of={Baz} got={i => expect(i).toBeInstanceOf(Baz)} />
          </Provider>
        </Provider>
      </Provider>
    )
  })

  it("will select extended class if found", () => {
    create(
      <Provider of={Baz}>
        <Consumer of={Bar} got={i => expect(i).toBeInstanceOf(Baz)} />
      </Provider>
    )
  })

  it("will select closest instance of same type", () => {
    create(
      <Provider of={Foo} value="outer">
        <Provider of={Foo} value="inner">
          <Consumer of={Foo} got={i => expect(i.value).toStrictEqual("inner")} />
        </Provider>
      </Provider>
    )
  });

  it("prefers closest match over best match", () => {
    create(
      <Provider of={Bar}>
        <Provider of={Baz}>
          <Consumer of={Baz} got={i => expect(i).toBeInstanceOf(Baz)} />
          <Consumer of={Bar} got={i => expect(i).toBeInstanceOf(Baz)} />
        </Provider>
      </Provider>
    )
  })
});

describe("Peers", () => {
  class Foo extends Controller {
    value = "foo";
  }
  
  class Baz extends Singleton {
    value = "baz";
  }
  
  beforeAll(() => Baz.create());

  it.todo("can access peers sharing same provider");

  it("can attach from context and singleton", () => {
    class Bar extends Controller {
      foo = tap(Foo);
      baz = tap(Baz);
    }

    const gotValues = jest.fn();

    function BarPeerConsumer(){
      const { foo, baz } = Bar.use();
      gotValues(foo.value, baz.value);
      return null;
    }

    create(
      <Provider of={Foo}>
        <BarPeerConsumer />
      </Provider>
    );

    expect(gotValues).toBeCalledWith("foo", "baz");
  })

  it("will reject from context if a singleton", () => {
    class Illegal extends Singleton {
      // foo is not also Global
      // this should fail
      foo = tap(Foo);
    }

    const attempt = () => Illegal.create();
    const error = Issue.CantAttachGlobal(Illegal.name, Foo.name)
    expect(attempt).toThrow(error);
  })
})