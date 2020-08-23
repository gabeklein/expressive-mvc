import { createElement, FC, PropsWithChildren, useEffect, useState } from 'react';

import { Controller, within } from './controller';
import { useManualRefresh } from './hook';
import { getObserver } from './observer';
import { useModelController } from './subscriber';

type onChangeCallback = (v: any, e: any) => any;

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
  return ({ of: target, ...props }) => {
    const onDidUpdate = useManualRefresh()[1];
    
    useEffect(() => {
      return getObserver(this).addListener(target, onDidUpdate);
    }, [])

    return createElement("span", props, within(this, target))
  }
}
