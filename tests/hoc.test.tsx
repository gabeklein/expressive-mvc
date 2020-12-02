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
    let injected: Controller;

    create(
      <instance.Component got={i => injected = i}/>
    );
    
    expect(injected).toStrictEqual(instance);
  });

  it("applies instance to class component", () => {
    class Test extends VC {
      Component = hoc(TestComponentClass);
    }

    const instance = Test.create();
    let injected: Controller;

    create(
      <instance.Component got={i => injected = i}/>
    )

    expect(injected).toStrictEqual(instance);
  });

  it("provides instance to children of component", () => {
    class Test extends VC {
      CustomProvider = wrap(TestComponentClass);
    }

    const instance = Test.create();
    let injected: Controller;

    create(
      <instance.CustomProvider>
        <Consumer of={Test} got={i => injected = i}/>
      </instance.CustomProvider>
    )

    expect(injected).toStrictEqual(instance);
  });
})

describe("Static HOCs", () => {
  class Test extends VC {
    constructor(){
      super();
    }
  };

  const TestProvider = Test.wrap(TestComponent);
  const TestConsumer = Test.hoc(TestComponent);

  it("creates new instance to provide children", () => {
    let consumed: Controller;

    create(
      <TestProvider>
        <Consumer of={Test} got={i => consumed = i}/>
      </TestProvider>
    )

    expect(consumed).toBeInstanceOf(Test);
  });

  it("custom provider receives own instance", () => {
    let provided: Controller;

    create(
      <TestProvider got={i => provided = i}/>
    )

    expect(provided).toBeInstanceOf(Test);
  });

  it("custom consumer applies instance to component", () => {
    let consumed: Controller;
    
    create(
      <Test.Provider>
        <TestConsumer got={i => consumed = i}/>
      </Test.Provider>
    )

    expect(consumed).toBeInstanceOf(Test);
  });

  it("provided and consumed instance is the same", () => {
    let produced: Controller;
    let consumed: Controller;

    create(
      <TestProvider got={i => produced = i}>
        <TestConsumer got={i => consumed = i}/>
      </TestProvider>
    )

    expect(produced).toStrictEqual(consumed);
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
    let child: Controller;
    let parent: Controller;

    create(
      <>
        <Parent.Direct got={i => parent = i}/>
        <Child.Direct got={i => child = i}/>
      </>
    )

    expect(parent).toBeInstanceOf(Parent);
    expect(child).toBeInstanceOf(Parent);
    expect(child).not.toBeInstanceOf(Child);
  });

  it("creates B from A.hoc if A used getter", () => {
    let created: Controller;

    create(
      <Child.Indirect got={i => created = i}/>
    )

    expect(created).toBeInstanceOf(Child);
  });

  it("caches B.hoc component between uses", () => {
    const A = Child.Indirect;
    const B = Child.Indirect;

    expect(A).toStrictEqual(B);
  })
})