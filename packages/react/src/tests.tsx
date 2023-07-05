import '@testing-library/jest-dom'

import { Model } from '@expressive/mvc';
import { render } from '@testing-library/react';
import React from 'react';

import { Provider } from './provider';

export function mockAsync<T = void>(){
  const pending = new Set<[Function, Function]>();

  const event = () => (
    new Promise<T>((res, rej) => {
      pending.add([res, rej]);
    })
  );

  const resolve = (value: T) => {
    const done = event();

    pending.forEach(x => x[0](value));
    pending.clear();

    return done;
  }

  return {
    pending: event,
    resolve
  }
}

export function mockHook<T>(
  callback: (props: {}) => T,
  provide?: Model){

  const opts = {} as {
    wrapper?: React.FC<{}> | undefined;
  };

  const Component = () => {
    const value = callback({});
    return <>{value}</>;
  }

  if(provide)
    opts.wrapper = ({ children }) => (
      <Provider for={provide}>
        {children}
      </Provider>
    )

  return render(<Component />, opts);
}