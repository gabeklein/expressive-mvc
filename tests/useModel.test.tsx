import React from 'react';

import { Model, useModel } from '../src';
import { render } from './adapter';

describe("import", () => {
  it("will ignore causal updates", async () => {
    class Test extends Model { 
      foo = "foo";
    }

    const didRender = jest.fn();
    const test = Test.create();

    const TestComponent = (props: any) => {
      const { foo } = useModel(test, props);
      didRender(foo);
      return null;
    }

    const element = render(<TestComponent />);

    expect(didRender).toBeCalledTimes(1);

    element.update(<TestComponent foo="bar" />);

    expect(didRender).toBeCalledTimes(2);
    expect(didRender).toBeCalledWith("bar");

    await test.update();

    expect(didRender).toBeCalledTimes(2);
  })
})