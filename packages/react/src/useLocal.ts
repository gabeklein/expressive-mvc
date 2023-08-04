import { Context, Control, Model } from '@expressive/mvc';
import { useEffect, useMemo, useState } from 'react';

import { RequireContext, useLookup } from './provider';

export const Applied = new WeakMap<Model, Context>();

export function useLocal <T extends Model> (
  this: Model.New<T>,
  apply?: Model.Values<T> | ((instance: T) => void),
  repeat?: boolean){

  const state = useState(0);
  const hook = useMemo(() => {
    const instance = this.new();
    const local = Control.watch(instance, () => onUpdate);
    const refresh = () => state[1](x => x+1);

    let onUpdate: (() => void) | undefined | null;
    let shouldApply = !!apply;

    return (props?: Model.Values<T> | ((instance: T) => void)) => {
      if(shouldApply){
        onUpdate = undefined;

        if(typeof props == "function")
          props(instance);

        else if(props)
          for(const key in instance)
            if(props.hasOwnProperty(key))
              instance[key] = (props as any)[key];

        if(!repeat)
          shouldApply = false;

        instance.set().then(() => onUpdate = refresh);
      }

      const applied = Applied.get(instance);

      if(applied)
        useLookup();

      else if(applied === undefined){
        const pending = RequireContext.get(instance);

        if(pending){
          const local = useLookup();

          pending.forEach(init => init(local));
          Applied.set(instance, local);
          RequireContext.delete(instance);
        }
      }

      useEffect(() => {
        onUpdate = refresh;
        return () => {
          onUpdate = null;
          instance.null();
        }
      }, []);

      return local;
    }
  }, []);

  return hook(apply);
}

export function getContext(from: Model){
  let waiting = RequireContext.get(from)!;

  if(!waiting)
    RequireContext.set(from, waiting = []);

  return (callback: (got: Context) => void) => {
    const applied = Applied.get(from);

    if(applied)
      callback(applied);
    else
      waiting.push(callback);
  }
}