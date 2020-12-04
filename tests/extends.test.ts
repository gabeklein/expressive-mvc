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
    value3 = 4;

    get value4(){
      return "bar";
    }
  }

  it("allowes inheritors to override", () => {
    const instance = Child.create();
    expect(instance.value3).toBe(4);
  })

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
    const { state } = test(Subject);

    expect(state.value).toBe(1);
    expect(state.value2).toBe(2);
  })

  it('passes arguments to constructor', () => {
    const { state } = test(() => {
      return Subject.use("Hello World!")
    })

    expect(state.init).toBe("Hello World!");
  })

  it('can initialize a Provider', () => {
    test(() => {
      const control = Subject.use();
      void control.Provider;
      return control;
    })
  })
})