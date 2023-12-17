import Model, { Context } from '@expressive/mvc';
import { ReactNode } from 'react';

import { createContext, setContext, useContext, useState } from './useContext';
import { PENDING, subscribe } from './useLocal';

export function createComponent<T extends Model, P extends Model.Values<T>> (
  this: Model.New<T>,
  render: (using: T & P) => ReactNode){

  const Component = ((argument: P) => {
    const state = useState(() => {
      const instance = new this();
      let apply: () => void;
      let context: Context;
  
      PENDING.set(instance, apply = () => {
        for(const key in instance)
          if(argument.hasOwnProperty(key))
            instance[key] = (argument as any)[key];
      });
  
      instance.set(0);

      const useLocal = subscribe(instance, () => {
        state[1]((x: Function) => x.bind(null));
      });

      return (props: P) => {
        const local = useLocal(() => {
          argument = props;
          apply();
        });

        const ambient = useContext();
  
        if(!context){
          context = ambient.push();
          setContext(instance, ambient);
          ambient.has(instance);
        }

        for(const key in props)
          if(!(key in local))
            Object.defineProperty(local, key, { value: props[key] });
  
        return createContext(context, render(local as T & P)); 
      };
    });

    return state[0](argument)
  }) as Model.Component<T, P>;

  Component.Model = this;
  Component.displayName = this.name;
  
  return Component;
}