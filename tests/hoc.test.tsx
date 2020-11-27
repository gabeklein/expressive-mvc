import React from "react";
import { create } from "react-test-renderer";

import VC, { hoc, wrap, Consumer } from "./adapter";

describe("Instance HOCs", () => {
  const injected = jest.fn();

  afterEach(() => injected.mockClear());

  class Parent extends VC {
    FunctionHOC = hoc(FunctionComponent)
    ClassHOC = hoc(ClassComponent);

    FunctionProvider = wrap(FunctionComponent);
    ClassProvider = wrap(ClassComponent);
  }

  const FunctionComponent = (props, control) => {
    injected(control);
    return props.children || null;
  }

  class ClassComponent extends React.Component {
    constructor(props, control){
      injected(control);
      super(props);
    }

    render(){
      return this.props.children || null;
    }
  }

  it("applies instance to function component", () => {
    const instance = Parent.create();
    create(<instance.FunctionHOC />);
    expect(injected).toBeCalledWith(instance);
  });

  it("applies instance to class component", () => {
    const instance = Parent.create();
    create(<instance.ClassHOC />);
    expect(injected).toBeCalledWith(instance);
  });

  it("provides instance to children of component", () => {
    const instance = Parent.create();
    const consumed = jest.fn();

    create(
      <instance.Provider>
        <Consumer of={Parent} got={i => {
          i = Object.getPrototypeOf(i);
          consumed(i);
        }} />
      </instance.Provider>
    )

    // expect(injected).toBeCalledWith(instance);
    expect(consumed).toBeCalledWith(instance);
  });
})

describe("Static HOCs", () => {
  class Test extends VC {};
  const TestElement = ({ children }, control) => {
    children = React.Children.toArray(children)

    if(typeof children[0] == "function"){
      children[0](control);
      return children.slice(1);
    }
    else
      return children || null;
  };

  const CustomProviderHOC = Test.wrap(TestElement);
  const CustomConsumerHOC = Test.hoc(TestElement);

  it("creates instance and provides to children", () => {
    create(
      <CustomProviderHOC>
        <Consumer of={Test} got={i => {
          expect(i).toBeInstanceOf(Test);
        }}/>
      </CustomProviderHOC>
    )
  });

  it("applies parent to component from context", () => {
    create(
      <Test.Provider>
        <CustomConsumerHOC>
          {i => expect(i).toBeInstanceOf(Test)}
        </CustomConsumerHOC>
      </Test.Provider>
    )
  });

  it("custom provider also receives instance", () => {
    create(
      <CustomProviderHOC>
        {i => expect(i).toBeInstanceOf(Test)}
      </CustomProviderHOC>
    )
  });

  it("provided and consumed instance is the same", () => {
    let instance: Test;

    create(
      <CustomProviderHOC>
        {i => instance = i}
        <CustomConsumerHOC>
          {i => expect(i).toBe(instance)}
        </CustomConsumerHOC>
      </CustomProviderHOC>
    )
  });
})