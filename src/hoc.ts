import { createElement, FC, PropsWithChildren } from 'react';

import { Controller } from './controller';
import { getObserver } from './observer';
import { useModelController } from './subscriber';

export function createWrappedComponent(
  this: typeof Controller, fn: FC<any>){

  const { Provider } = this.context!;
  
  return (forwardedProps: PropsWithChildren<any>) => {
    const self = useModelController(this);
    const current = getObserver(self);

    self.assign(forwardedProps);
    
    return createElement(Provider, { value: self }, 
      createElement(fn, { self, ...current.values })
    )
  }
}