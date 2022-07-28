import React from 'react';

import { render } from '../../tests/adapter';
import { Model } from '../model';
import { Provider } from './provider';
import { useTap } from './useTap';

class Test extends Model {}

it("will get base-model from context", () => {
  const Hook = () => {
    const value = useTap(Test);
    expect(value).toBeInstanceOf(Test);
    return null;
  }

  render(
    <Provider for={Test}>
      <Hook />
    </Provider>
  );
})