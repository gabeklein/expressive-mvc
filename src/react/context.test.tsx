import React from 'react';

import { render } from '../helper/testing';
import { Oops } from './context';
import { MVC } from './mvc';
import { Provider } from './provider';

describe("get", () => {
  class Test extends MVC {
    value = "foo";
  }

  it("will get instance of model", () => {
    const Hook = () => {
      const value = Test.get("value");
      expect(value).toBe("foo")
      return null;
    }

    render(
      <Provider for={Test}>
        <Hook />
      </Provider>
    );
  })

  it("will fail if not found", () => {
    const Hook = () => {
      Test.get();
      return null;
    }

    const test = () => render(<Hook />);

    expect(test).toThrowError(
      Oops.NotFound(Test.name)
    );
  })


  it("will run callback if function", async () => {
    const willMount = jest.fn(() => willUnmount);
    const willUnmount = jest.fn();

    const Hook = () => {
      Test.get(willMount);
      return null;
    }

    const element = render(
      <Provider for={Test}>
        <Hook />
      </Provider>
    );

    expect(willMount).toBeCalledWith(expect.any(Test));

    element.unmount();

    expect(willUnmount).toBeCalled();
  })
})
