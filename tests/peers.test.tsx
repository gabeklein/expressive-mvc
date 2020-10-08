import React from "react";
import { create } from "react-test-renderer";

import { Controller, get, Singleton } from "./adapter";

class Foo extends Controller {
  value = "foo";
}

class Bar extends Controller {
  foo = get(Foo);
  baz = get(Baz);
}

class Baz extends Singleton {
  value = "baz"
}

class Bad extends Singleton {
  // foo is not also Global
  // this should fail
  foo = get(Foo);
}

beforeAll(() => {
  Baz.create();
})

describe("Peers", () => {
  it("can attach from context and singleton", () => {
    const check = jest.fn();

    function BarPeerConsumer(){
      const { foo, baz } = Bar.use();
      check(foo.value, baz.value);
      return null;
    }

    create(
      <Foo.Provider>
        <BarPeerConsumer />
      </Foo.Provider>
    );

    expect(check).toBeCalledWith("foo", "baz");
  })

  it("will reject from context if a singleton", () => {
    expect(() => Bad.create()).toThrow()
  })

  it.todo("can access peers sharing same provider")
})

describe("Singleton", () => {
  it.todo("may attach from context if created though use")
})