import React from 'react';
import { create } from 'react-test-renderer';

import { Consumer, Controller, Issue, Provider, Singleton, tap } from './adapter';

class Foo extends Controller {}
class Bar extends Controller {}
class Baz extends Bar {}

describe("Provider", () => {
  it("provides an existing instance of controller", () => {
    const instance = Foo.create();

    create(
      <instance.Provider>
        <Consumer of={Foo} got={i => expect(i).toStrictEqual(instance)} />
      </instance.Provider>
    );
  })

  it("creates an instance of parent controller", () => {
    create(
      <Foo.Provider>
        <Consumer of={Foo} got={i => expect(i).toBeInstanceOf(Foo)} />
      </Foo.Provider>
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
})

describe("Consumer", () => {
  it("can handle complex arrangement", () => {
    const instance = Foo.create();

    create(
      <instance.Provider>
        <Baz.Provider>
          <Provider of={{ Bar }}>
            <Consumer of={Foo} got={i => expect(i).toStrictEqual(instance)} />
            <Consumer of={Bar} got={i => expect(i).toBeInstanceOf(Bar)} />
            <Consumer of={Baz} got={i => expect(i).toBeInstanceOf(Baz)} />
          </Provider>
        </Baz.Provider>
      </instance.Provider>
    )
  })

  it("will select extended class if found", () => {
    create(
      <Baz.Provider>
        <Consumer of={Bar} got={i => expect(i).toBeInstanceOf(Baz)} />
      </Baz.Provider>
    )
  })

  it("prefers closest match over best match", () => {
    create(
      <Bar.Provider>
        <Baz.Provider>
          <Consumer of={Baz} got={i => expect(i).toBeInstanceOf(Baz)} />
          <Consumer of={Bar} got={i => expect(i).toBeInstanceOf(Baz)} />
        </Baz.Provider>
      </Bar.Provider>
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
      <Foo.Provider>
        <BarPeerConsumer />
      </Foo.Provider>
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