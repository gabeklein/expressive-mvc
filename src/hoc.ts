import { createElement, FC, forwardRef, useEffect, useState } from 'react';

import { DISPATCH } from './dispatch';
import { Set } from './polyfill';
import { ModelController, UpdateTrigger } from './types';

const { assign } = Object;

interface AccessorComponentProps {
  of: string;
}

export function ControlledValue(
  this: ModelController): FC<AccessorComponentProps> {
    
  const dispatch = this[DISPATCH];

  return (props) => {
    const setUpdate = useState(0)[1];
    const key = props.of;
    props = assign({}, props);
    delete props.of;


    useEffect(() => {
      let watchers: Set<UpdateTrigger> = 
        dispatch[key] || ((<any>dispatch[key]) = new Set());

      watchers.add(setUpdate);

      return () => watchers.delete(setUpdate);
    })

    return createElement("span", props, (this as any)[key])
  }
}

export function ControlledInput(
  this: ModelController): FC<AccessorComponentProps> {
    
  const dispatch = this[DISPATCH];
  const control = this as any;

  return forwardRef((props, ref) => {
    const setUpdate = useState(0)[1];

    const key = props.of;
    props = assign({}, props);
    delete props.of;

    useEffect(() => {
      let watchers: Set<UpdateTrigger> = 
        dispatch[key] || (dispatch[key] = new Set());

      watchers.add(setUpdate);

      return () => watchers.delete(setUpdate);
    });
    
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