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
    const log = jest.fn();

    create(
      <FooProvider>
        <Consumer of={Foo} got={i => log(i.foo)}/>
      </FooProvider>
    );

    expect(log).toBeCalledWith("foo");
  })

  it("creates an instance of parent controller", () => {
    const log = jest.fn();

    create(
      <Foo.Provider>
        <Consumer of={Foo} got={i => log(i.foo)}/>
      </Foo.Provider>
    );

    expect(log).toBeCalledWith("foo");
  })

  it("creates multiple instances via MultiProvider", () => {
    const log = jest.fn();
    
    create(
      <Provider of={{ Foo, Bar }}>
        <Consumer of={Foo} got={i => log(i.foo)}/>
        <Consumer of={Bar} got={i => log(i.bar)}/>
      </Provider>
    )

    expect(log).toBeCalledWith("foo");
    expect(log).toBeCalledWith("bar");
  })
})

describe("Consumer", () => {
  it("can handle complex arrangement", () => {
    const log = jest.fn();
    
    create(
      <FooProvider>
        <Baz.Provider>
          <Provider of={{ Bar }}>
            <Consumer of={Foo} got={i => log(i.foo)}/>
            <Consumer of={Bar} got={i => log(i.bar)}/>
            <Consumer of={Baz} got={i => log(i.baz)}/>
          </Provider>
        </Baz.Provider>
      </FooProvider>
    )

    expect(log).toBeCalledWith("foo");
    expect(log).toBeCalledWith("bar");
    expect(log).toBeCalledWith("baz");
  })

  it("may select a super-instance instead", () => {
    const log = jest.fn();
    
    create(
      <Baz.Provider>
        <Consumer of={Bar} got={i => log(i.bar)}/>
      </Baz.Provider>
    )

    expect(log).toBeCalledWith("foobar");
  })

  it("prefers closest over best match", () => {
    const log = jest.fn();
    
    create(
      <Bar.Provider>
        <Baz.Provider>
          <Consumer of={Baz} got={i => log(i.bar)}/>
          <Consumer of={Bar} got={i => log(i.bar)}/>
        </Baz.Provider>
      </Bar.Provider>
    )

    expect(log).toBeCalledTimes(2);
    expect(log).toBeCalledWith("foobar");
    expect(log).not.toBeCalledWith("bar");
  })
})