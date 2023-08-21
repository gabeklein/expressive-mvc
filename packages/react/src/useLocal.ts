import { Context, Model } from '@expressive/mvc';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const Shared = createContext(new Context());
const Register = new WeakMap<Model, Context | ((context: Context) => void)[]>();

function useLocal <T extends Model> (
  this: Model.New<T>,
  apply?: Model.Values<T> | ((instance: T) => void),
  repeat?: boolean){

  const state = useState(0);
  const hook = useMemo(() => {
    const instance = this.new() as T;

    let local: T;
    let enabled: boolean | undefined;
    let shouldApply = !!apply;

    const detach = instance.get(current => {
      local = current;

      if(enabled)
        state[1](x => x+1);
    });

    return (props?: Model.Values<T> | ((instance: T) => void)) => {
      if(shouldApply){
        enabled = false;

        if(typeof props == "function")
          props(instance);

        else if(props)
          for(const key in instance)
            if(props.hasOwnProperty(key))
              instance[key] = (props as any)[key];

        if(!repeat)
          shouldApply = false;

        instance.set().then(() => enabled = true);
      }

      setContext(instance, useContext(Shared));

      useEffect(() => {
        enabled = true;
        return () => {
          detach();
          instance.null();
        }
      }, []);

      return local;
    }
  }, []);

  return hook(apply);
}

function getContext(from: Model, resolve: (got: Context) => void){
  const context = Register.get(from);

  if(context instanceof Context)
    resolve(context);
  else if(context)
    context.push(resolve);
  else
    Register.set(from, [resolve]);
}

function setContext(model: Model, context: Context){
  const waiting = Register.get(model);

  if(waiting instanceof Array)
    waiting.forEach(cb => cb(context));

  Register.set(model, context);
}

export {
  useLocal,
  getContext,
  setContext,
  Shared
}