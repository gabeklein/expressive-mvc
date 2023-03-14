import React from 'react';

import { render } from '../helper/testing';
import { Model } from './mvc';
import { Provider } from './provider';
import { Oops } from './useContext';

describe("get", () => {
  class Test extends Model {
    value = "foo";
  }

  it("will get instance of model", () => {
    const Hook = () => {
      const value = Test.get().value;
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
})
