import { createElement, FC, forwardRef, useEffect, useState } from 'react';

import { ModelController } from './types';

const { assign } = Object;

export function ControlledValue(
  this: ModelController): FC<{ of: string }> {
    
  return (props) => {
    const setUpdate = useState(0)[1];
    const key = props.of;
    props = assign({}, props);
    delete props.of;

    useEffect(() => {
      const removeListener = 
        this.dispatch.addListener(key, setUpdate);

      return removeListener;
    })

    return createElement("span", props, (this as any)[key])
  }
}

export function ControlledInput(
  this: ModelController): FC<{ to: string }> {
    
  const control = this as any;

  return forwardRef((props, ref) => {
    const setUpdate = useState(0)[1];

    const key = props.to;
    props = assign({}, props);
    delete props.to;

    useEffect(() => {
      const removeListener =
        control.dispatch.addListener(key, setUpdate);

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