import Controller, { def } from './adapter';

/**
 * This stopped working after TS 4.0.
 * Now yeilds compiler error (ts2611).
 * May neeed to deprecate this feature.
 */

describe("default Directive", () => {
  it("yeilds to getter with same name", () => {
    class Parent extends Controller {
      value = def("foobar");
    }

    class Child extends Parent {
      // @ts-ignore
      get value(){
        return "barbaz"
      }
    }

    const test = Child.create();

    expect(test.value).toBe("barbaz");
  })
})

describe("computed", () => {
  class A extends Controller {
    a = "foo";
    b = def("foo");
    get c(){ return "foo" }
    get d(){ return "foo" }
  }

  class B extends A {
    //@ts-ignore
    get a(){ return "bar" }

    //@ts-ignore
    get b(){ return "bar" }

    get c(){ return "bar" }

    //@ts-ignore
    d = "bar";
  }

  test("B getter wont override A value", () => {
    const test = B.create();
    expect(test.a).toBe("foo");
  })

  test("B getter will override A default", () => {
    const test = B.create();
    expect(test.b).toBe("bar");
  })

  test("B getter will override A getter", () => {
    const test = B.create();
    expect(test.c).toBe("bar");
  })

  test("B value will override A getter", () => {
    const test = B.create();
    expect(test.d).toBe("bar");
  })
})