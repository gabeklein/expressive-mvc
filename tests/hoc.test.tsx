import React, { ReactNode } from "react";
import { create } from "react-test-renderer";
import Controller from "..";

import VC, { hoc, wrap, Consumer } from "./adapter";

interface TestComponentProps {
  got?: (control: Controller) => void;
  children?: ReactNode;
}

function TestComponent(props: TestComponentProps, control: Controller){
  if(props.got)
    props.got(control);

  return props.children || null;
}

class TestComponentClass extends React.Component<TestComponentProps> {
  constructor(props: TestComponentProps, control: Controller){
    super(props);

    if(props.got)
      props.got(control);
  }

  render(){
    return this.props.children || null;
  }
}

describe("Instance HOCs", () => {
  it("applies instance to function component", () => {
    class Test extends VC {
      Component = hoc(TestComponent);
    }

    const instance = Test.create();

    create(
      <instance.Component got={i => 
        expect(i).toStrictEqual(instance)
      }/>
    );
  });

  it("applies instance to class component", () => {
    class Test extends VC {
      Component = hoc(TestComponentClass);
    }

    const instance = Test.create();

    create(
      <instance.Component got={i => 
        expect(i).toStrictEqual(instance)
      }/>
    );
  });

  it("provides instance to children of component", () => {
    class Test extends VC {
      CustomProvider = wrap(TestComponentClass);
    }

    const instance = Test.create();

    create(
      <instance.CustomProvider>
        <Consumer of={Test} got={i => 
          expect(i).toStrictEqual(instance)
        }/>
      </instance.CustomProvider>
    )
  });
})

describe("Static HOCs", () => {
  class Test extends VC {};
  const TestProvider = Test.wrap(TestComponent);
  const TestConsumer = Test.hoc(TestComponent);

  it("provides new instance to children", () => {
    create(
      <TestProvider>
        <Consumer of={Test} got={i => 
          expect(i).toBeInstanceOf(Test)
        }/>
      </TestProvider>
    )
  });

  it("custom provider receives own instance", () => {
    create(
      <TestProvider got={i => 
        expect(i).toBeInstanceOf(Test)
      }/>
    )
  });

  it("custom consumer applies instance to component", () => {
    create(
      <Test.Provider>
        <TestConsumer got={i => 
          expect(i).toBeInstanceOf(Test)
        }/>
      </Test.Provider>
    )
  });

  it("provided and consumed instance is the same", () => {
    let instance: Test;

    create(
      <TestProvider got={i => instance = i}>
        <TestConsumer got={i => 
          expect(i).toStrictEqual(instance)
        }/>
      </TestProvider>
    )
  });
});

describe("Inheritable HOCs", () => {
  class Parent extends VC {
    static Direct = Parent.wrap(TestComponent);
    static get Indirect(){
      return this.wrap(TestComponent);
    }
  }

  class Child extends Parent {};

  it("creates A from A.hoc always", () => {
    create(
      <Parent.Direct got={i => {
        expect(i).toBeInstanceOf(Parent);
      }}/>
    )
    create(
      <Child.Direct got={i => {
        expect(i).toBeInstanceOf(Parent);
        expect(i).not.toBeInstanceOf(Child);
      }}/>
    )
  });

  it("creates B from A.hoc if A used getter", () => {
    create(
      <Child.Indirect got={i => {
        expect(i).toBeInstanceOf(Child);
      }}/>
    )
  });

  it("caches B.hoc component between uses", () => {
    const A = Child.Indirect;
    const B = Child.Indirect;

    expect(A).toStrictEqual(B);
  })
})