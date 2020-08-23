import { createElement, FC, PropsWithChildren, useEffect, useState } from 'react';

import { Controller, within } from './controller';
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

export function ControlledValue(this: Controller): FC<{ of: string }> {
  return ({ of: key, ...props }) => {
    const [ value, onUpdate ] = useState(() => within(this, key));
    
    useEffect(() => {
      return getObserver(this).watch(key, onUpdate);
    }, [])

    return createElement("span", props, value);
  }
}