import React from "react";
import { create } from "react-test-renderer";

import { Consumer, Controller, Provider, get, Issue, Singleton } from "./adapter";

class Foo extends Controller {}
class Bar extends Controller {}
class Baz extends Bar {}

describe("Provider", () => {
  it("provides an existing instance of controller", () => {
    const instance = Foo.create();
    let injected;

    create(
      <instance.Provider>
        <Consumer of={Foo} got={i => injected = i}/>
      </instance.Provider>
    );

    expect(injected).toStrictEqual(instance);
  })

  it("creates an instance of parent controller", () => {
    let injected;

    create(
      <Foo.Provider>
        <Consumer of={Foo} got={i => injected = i}/>
      </Foo.Provider>
    );

    expect(injected).toBeInstanceOf(Foo);
  })

  it("creates multiple instances via MultiProvider", () => {
    let bar, foo;
    
    create(
      <Provider of={{ Foo, Bar }}>
        <Consumer of={Foo} got={i => foo = i}/>
        <Consumer of={Bar} got={i => bar = i}/>
      </Provider>
    )

    expect(foo).toBeInstanceOf(Foo);
    expect(bar).toBeInstanceOf(Bar);
  })
})

describe("Consumer", () => {
  it("can handle complex arrangement", () => {
    const instance = Foo.create();
    let foo, bar, baz;

    create(
      <instance.Provider>
        <Baz.Provider>
          <Provider of={{ Bar }}>
            <Consumer of={Foo} got={i => foo = i}/>
            <Consumer of={Bar} got={i => bar = i}/>
            <Consumer of={Baz} got={i => baz = i}/>
          </Provider>
        </Baz.Provider>
      </instance.Provider>
    )

    expect(foo).toStrictEqual(instance);
    expect(bar).toBeInstanceOf(Bar);
    expect(baz).toBeInstanceOf(Baz);
  })

  it("will select extended class if found", () => {
    let bar;
    
    create(
      <Baz.Provider>
        <Consumer of={Bar} got={i => bar = i}/>
      </Baz.Provider>
    )

    expect(bar).toBeInstanceOf(Baz);
  })

  it("prefers closest match over best match", () => {
    let foundBar, foundBaz;

    create(
      <Bar.Provider>
        <Baz.Provider>
          <Consumer of={Baz} got={i => foundBaz = i}/>
          <Consumer of={Bar} got={i => foundBar = i}/>
        </Baz.Provider>
      </Bar.Provider>
    )

    expect(foundBaz).toBeInstanceOf(Baz);
    expect(foundBar).toBeInstanceOf(Baz);
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
      foo = get(Foo as any) as Foo;
      baz = get(Baz as any) as Baz;
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
      foo = get(Foo as any) as Foo;
    }

    const attempt = () => Illegal.create();
    const error = Issue.CantAttachGlobal(Illegal.name, Foo.name)
    expect(attempt).toThrow(error);
  })
})