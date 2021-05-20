import { Controller } from "./adapter";

describe("computed", () => {
  class Parent extends Controller {
    value = 1;
    value2 = 2;

    get value3(){
      return this.value + this.value2;
    }

    get value4(){
      return "foo";
    }
  }

  class Child extends Parent {
    get value4(){
      return "bar";
    }
  }

  it("picks closest getter for computed", () => {
    const instance = Child.create();
    expect(instance.value4).toBe("bar");
  });
})