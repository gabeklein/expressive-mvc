import React, { useLayoutEffect } from 'react';

import { render } from '../../tests/adapter';
import { MVC } from './mvc';
import { Provider } from './provider';
import { Oops, useLocal } from './useLocal';

describe("get", () => {
  class Test extends MVC {
    value = "foo";
  }

  it("will get instance of model", () => {
    const Hook = () => {
      const value = useLocal(Test, "value");
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
      useLocal(Test);
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
      useLocal(Test, willMount);
      void useLayoutEffect;
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
