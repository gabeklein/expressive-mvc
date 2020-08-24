import { createElement, FC, PropsWithChildren } from 'react';

import { Controller } from './controller';
import { getObserver } from './observer';
import { useNewController } from './subscriber';

export function createWrappedComponent(
  this: typeof Controller, fn: FC<any>){

  const { Provider } = this.context!;
  
  return (forwardedProps: PropsWithChildren<any>) => {
    const self = useNewController(this);
    const current = getObserver(self);

    self.assign(forwardedProps);
    
    return createElement(Provider, { value: self }, 
      createElement(fn, { self, ...current.values })
    )
  }
}