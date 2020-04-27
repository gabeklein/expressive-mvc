import { createElement, FC, forwardRef, useEffect } from 'react';

import { DISPATCH } from './dispatch';
import { useManualRefresh } from './hook';
import { ModelController } from './types';

const { assign } = Object;

export function ControlledValue(
  this: ModelController): FC<{ of: string }> {
    
  return (props) => {
    const onDidUpdate = useManualRefresh()[1];
    const key = props.of;
    props = assign({}, props);
    delete props.of;

    useEffect(() => {
      const removeListener = 
        this[DISPATCH]!.addListener(key, onDidUpdate);

      return removeListener;
    })

    return createElement("span", props, (this as any)[key])
  }
}

export function ControlledInput(
  this: ModelController): FC<{ to: string }> {

  return forwardRef((props, ref) => {
    const onDidUpdate = useManualRefresh()[1];
    const values = this as any;

    const key = props.to;
    props = assign({}, props);
    delete props.to;

    useEffect(() => this[DISPATCH]!.addListener(key, onDidUpdate))
    
    props = Object.assign(props, {
      ref,
      type: "text",
      value: values[key],
      onChange: (e: any) => {
        values[key] = e.target.value;
      }
    })

    return createElement("input", props)
  })
}