import { Context, Model } from '@expressive/mvc';
import { useShared, useEffect, useState } from './useContext';
import { ReactNode } from 'react';

export function createComponent<T extends Model, P extends Model.Assign<T>> (
  this: Model.Type<T>,
  render: (using: T & P) => ReactNode){

  const Component = ((inputProps: P) => {
    const outer = useShared();
    const state = useState(() => {
      let enabled = false;
      let context: Context;
      let local: T;

      const instance = new this(inputProps as Model.Argument);
      const release = instance.get(current => {
        local = current;

        if(enabled)
          state[1]((x: Function) => x.bind(null));
      });

      return (props?: Model.Assign<T>) => {
        if(!context)
          context = outer.push({ instance });

        if(enabled){
          enabled = false;
  
          if(typeof props == "object")
            instance.set(props);

          const update = instance.set();
  
          if(update)
            update.then(() => enabled = true);
          else
            enabled = true;
        }

        for(const key in props)
          if(!(key in local))
            Object.defineProperty(local, key, {
              value: inputProps[key]
            });

        useEffect(() => {
          enabled = true;
          return () => {
            release();
            instance.set(null);
            context.pop()
          }
        }, []);
      
        return render(local as T & P); 
      };
    });

    return state[0](inputProps) as any;
  }) as Model.Component<T, P>;

  Component.Model = this;
  Component.displayName = this.name;
  
  return Component;
}