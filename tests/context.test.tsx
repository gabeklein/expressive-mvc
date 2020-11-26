import React from "react";
import { create } from "react-test-renderer";

import { Controller, Provider } from "./adapter";

type InstanceOf<T> = T extends { prototype: infer U } ? U : never;

interface TestConsumerProps<T>{
  of: T;
  got: (instance: InstanceOf<T>) => void;
}

function Consumer<T>
  ({ of: Subject, got }: TestConsumerProps<T>){

  const instance = (Subject as any).get();
  got(instance);
  return null;
}

class Foo extends Controller {
  foo = "foo";
}

class Bar extends Controller {
  bar = "bar"
}

class Baz extends Bar {
  bar = "foobar";
  baz = "baz";
}

function FooProvider({ children }: any){
  const { Provider } = Foo.use();
  return <Provider>{children}</Provider>;
}

describe("Provider", () => {
  it("provides an existing instance of controller", () => {
    const foo = jest.fn();

    create(
      <FooProvider>
        <Consumer of={Foo} got={i => foo(i.foo)}/>
      </FooProvider>
    );

    expect(foo).toBeCalledWith("foo");
  })

  it("creates an instance of parent controller", () => {
    const foo = jest.fn();

    create(
      <Foo.Provider>
        <Consumer of={Foo} got={i => foo(i.foo)}/>
      </Foo.Provider>
    );

    expect(foo).toBeCalledWith("foo");
  })

  it("creates multiple instances via MultiProvider", () => {
    const foo = jest.fn();
    const bar = jest.fn();
    
    create(
      <Provider of={{ Foo, Bar }}>
        <Consumer of={Foo} got={i => foo(i.foo)}/>
        <Consumer of={Bar} got={i => bar(i.bar)}/>
      </Provider>
    )

    expect(foo).toBeCalledWith("foo");
    expect(bar).toBeCalledWith("bar");
  })
})

describe("Consumer", () => {
  it("can handle complex arrangement", () => {
    const foo = jest.fn();
    const bar = jest.fn();
    const baz = jest.fn();
    
    create(
      <FooProvider>
        <Baz.Provider>
          <Provider of={{ Bar }}>
            <Consumer of={Baz} got={i => baz(i.baz)}/>
            <Consumer of={Foo} got={i => foo(i.foo)}/>
            <Consumer of={Bar} got={i => bar(i.bar)}/>
          </Provider>
        </Baz.Provider>
      </FooProvider>
    )

    expect(foo).toBeCalledWith("foo");
    expect(bar).toBeCalledWith("bar");
    expect(baz).toBeCalledWith("baz");
  })

  it("may select a super-instance instead", () => {
    const bar = jest.fn();
    
    create(
      <Baz.Provider>
        <Consumer of={Bar} got={i => bar(i.bar)}/>
      </Baz.Provider>
    )

    expect(bar).toBeCalledWith("foobar");
  })

  it("prefers closest over best match", () => {
    const bar = jest.fn();
    
    create(
      <Bar.Provider>
        <Baz.Provider>
          <Consumer of={Baz} got={i => bar(i.bar)}/>
          <Consumer of={Bar} got={i => bar(i.bar)}/>
        </Baz.Provider>
      </Bar.Provider>
    )

    expect(bar).toBeCalledTimes(2);
    expect(bar).toBeCalledWith("foobar");
    expect(bar).not.toBeCalledWith("bar");
  })
})