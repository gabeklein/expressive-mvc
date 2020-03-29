import { createElement, FC, forwardRef, useEffect, useState } from 'react';

import { ModelController } from './types';

const { assign } = Object;

interface AccessorComponentProps {
  of: string;
}

export function ControlledValue(
  this: ModelController): FC<AccessorComponentProps> {
    
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
  this: ModelController): FC<AccessorComponentProps> {
    
  const control = this as any;

  return forwardRef((props, ref) => {
    const setUpdate = useState(0)[1];

    const key = props.of;
    props = assign({}, props);
    delete props.of;

    useEffect(() => {
      const removeListener =
        this.dispatch.addListener(props.of, setUpdate);

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