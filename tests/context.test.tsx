import React from "react";
import { create } from "react-test-renderer";

import { Consumer, Controller, Provider } from "./adapter";

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
})