import { createElement, FC, useEffect, useState } from 'react';

import { DISPATCH } from './dispatch';
import { Set } from './polyfill';
import { ModelController, UpdateTrigger } from './types';

interface AccessorComponentProps {
  of: string;
}

const {
  defineProperty: define
} = Object;

export function useAccessorComponent(
  this: ModelController ){
    
  const dispatch = this[DISPATCH];

  const Accessor: FC<AccessorComponentProps> = 
    ({ of: ofProp, ...props }) => {
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
    
  define(this, "Value", { value: Accessor });
  return Accessor;
}