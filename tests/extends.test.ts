import Controller, { test } from "./adapter";

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

describe("extension", () => {
  class Subject extends Controller {
    value = 1;
    value2 = 2;

    constructor(
      public init?: string){
      super();
    }

    setValueToThree = () => {
      this.value = 3;
    }
  }

  it('initializes from extended Controller', () => {
    const state = Subject.create();

    expect(state.value).toBe(1);
    expect(state.value2).toBe(2);
  })

  it('passes arguments to constructor', () => {
    const { state } = test(() => {
      return Subject.use("Hello World!")
    })

    expect(state.init).toBe("Hello World!");
  })
})