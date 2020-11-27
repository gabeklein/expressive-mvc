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
      <instance.Component got={
        i => expect(i).toStrictEqual(instance)
      }/>
    );
  });

  it("applies instance to class component", () => {
    class Test extends VC {
      Component = hoc(TestComponentClass);
    }

    const instance = Test.create();

    create(
      <instance.Component got={
        i => expect(i).toStrictEqual(instance)
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
        <Consumer of={Test} got={
          //TODO: this should not need to be unwrapped.
          i => expect(Object.getPrototypeOf(i)).toStrictEqual(instance)
        }/>
      </instance.CustomProvider>
    )
  });
})

describe("Static HOCs", () => {
  class Test extends VC {};
  const TestProvider = Test.wrap(TestComponent);
  const TestConsumer = Test.hoc(TestComponent);

  it("creates instance and provides to children", () => {
    create(
      <TestProvider>
        <Consumer of={Test} got={
          i => expect(i).toBeInstanceOf(Test)
        }/>
      </TestProvider>
    )
  });

  it("applies parent to component from context", () => {
    create(
      <Test.Provider>
        <TestConsumer got={
          i => expect(i).toBeInstanceOf(Test)
        }/>
      </Test.Provider>
    )
  });

  it("custom provider also receives instance", () => {
    create(
      <TestProvider got={
        i => expect(i).toBeInstanceOf(Test)
      }/>
    )
  });

  it("provided and consumed instance is the same", () => {
    let instance: Test;

    create(
      <TestProvider got={i => instance = i}>
        <TestConsumer got={
          i => expect(i).toStrictEqual(instance)
        }/>
      </TestProvider>
    )
  });
})