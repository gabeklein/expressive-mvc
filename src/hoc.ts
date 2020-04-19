import { createElement, FC, forwardRef, useEffect } from 'react';

import { useRefresh } from './subscriber';
import { ModelController } from './types';

const { assign } = Object;

export function ControlledValue(
  this: ModelController): FC<{ of: string }> {
    
  return (props) => {
    const onDidUpdate = useRefresh();
    const key = props.of;
    props = assign({}, props);
    delete props.of;

    useEffect(() => {
      const removeListener = 
        this.dispatch!.addListener(key, onDidUpdate);

      return removeListener;
    })

    return createElement("span", props, (this as any)[key])
  }
}

export function ControlledInput(
  this: ModelController): FC<{ to: string }> {
    
  const control = this as any;

  return forwardRef((props, ref) => {
    const onDidUpdate = useRefresh();

    const key = props.to;
    props = assign({}, props);
    delete props.to;

    useEffect(() => {
      const removeListener =
        control.dispatch.addListener(key, onDidUpdate);

      return removeListener;
    })
    
    props = Object.assign(props, {
      ref,
      type: "text",
      value: control[key],
      onChange: (e: any) => {
        control[key] = e.target.value;
      }
    })

    return createElement("input", props)
  })
}