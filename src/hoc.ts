import { createElement, FC, forwardRef, FunctionComponent, PropsWithChildren, useEffect } from 'react';

import { Controller, within } from './controller';
import { useManualRefresh } from './hook';
import { getObserver } from './observer';
import { useModelController } from './subscriber';

type onChangeCallback = (v: any, e: any) => any;

export function createWrappedComponent<T extends typeof Controller>(
  this: T,
  fn: FunctionComponent<InstanceType<T>> ){

  const { Provider } = this.context!;
  
  return (forwardedProps: PropsWithChildren<any>) => {
    const controller = useModelController(this);
    controller.assign(forwardedProps);
    const { values } = getObserver(controller);

    const useProps: any = { 
      use: controller, 
      ...values 
    }
    
    return createElement(
      Provider, { value: controller }, 
      createElement(fn, useProps)
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
