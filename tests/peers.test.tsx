import React from "react";
import { create } from "react-test-renderer";

import { Controller, get, Singleton, Issue } from "./adapter";

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
    const attempt = () => Bad.create();
    const error = Issue.CantAttachGlobal(Bad.name, Foo.name)
    expect(attempt).toThrow(error);
  })

  it.todo("can access peers sharing same provider")
})