import React from 'react';

import { Consumer, Controller, hoc, render, wrap } from './adapter';

type TestComponentProps = React.PropsWithChildren<{
  got?: (control: any) => void;
}>

const TestComponentFunction = (props: TestComponentProps, control: any) => {
  if(props.got)
    props.got(control);

  return props.children || null;
}

class TestComponentClass extends React.Component<TestComponentProps> {
  constructor(props: TestComponentProps, control: any){
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
    class Test extends Controller {
      Component = hoc(TestComponentFunction);
    }

    const { Component, get: instance } = Test.create();

    render(
      <Component got={i => expect(i).toStrictEqual(instance)} />
    );
  });

  it("applies instance to class component", () => {
    class Test extends Controller {
      Component = hoc(TestComponentClass);
    }

    const { Component, get: instance } = Test.create();

    render(
      <Component got={i => expect(i).toStrictEqual(instance)} />
    );
  });

  it("provides instance to children of component", () => {
    class Test extends Controller {
      CustomProvider = wrap(TestComponentClass);
    }

    const { CustomProvider, get: instance } = Test.create();

    render(
      <CustomProvider>
        <Consumer of={Test} get={i => expect(i).toStrictEqual(instance)} />
      </CustomProvider>
    )
  });
})