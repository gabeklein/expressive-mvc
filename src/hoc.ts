import { createElement, FC, useEffect, useState, forwardRef } from 'react';

import { DISPATCH } from './dispatch';
import { Set } from './polyfill';
import { ModelController, UpdateTrigger } from './types';

interface AccessorComponentProps {
  of: string;
}

export function ControlledValue(
  this: ModelController): FC<AccessorComponentProps> {
    
  const dispatch = this[DISPATCH];

  return ({ of: ofProp, ...props }) => {
    const setUpdate = useState(0)[1];
    const key = ofProp;

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
    
  const dispatch = this[DISPATCH] as any;
  const control = this as any;

  return forwardRef(({ of: key, ...props }, ref) => {
    const setUpdate = useState(0)[1];

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