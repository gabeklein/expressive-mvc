import React from 'react';

import { render } from '../../tests/adapter';
import { MVC } from './mvc';
import { Provider } from './provider';
import { Oops as Context } from './useInContext';

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
      <Provider of={Test}>
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
      Context.NothingInContext(Test.name)
    );
  })
})
