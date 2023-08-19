import { Context, Control, Model } from '@expressive/mvc';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const Shared = createContext(new Context());
const Register = new WeakMap<Model, Context | ((context: Context) => void)[]>();

function useLocal <T extends Model> (
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

      setContext(instance, useContext(Shared));

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