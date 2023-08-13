import { Context, Model } from '@expressive/mvc';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const Applied = new WeakMap<Model, Context>();
const Expects = new WeakMap<Model, ((context: Context) => void)[]>();
const ModelContext = createContext(new Context());

function useLocal <T extends Model> (
  this: Model.New<T>,
  apply?: Model.Values<T> | ((instance: T) => void),
  repeat?: boolean){

  const state = useState(0);
  const hook = useMemo(() => {
    const instance = this.new() as T;
    let shouldApply = !!apply;
    let lock = true;
    let local: any;

    const remove = instance.get(current => {
      local = current;
      if(!lock)
        state[1](x => x+1);
    })

    return (props?: Model.Values<T> | ((instance: T) => void)) => {
      if(shouldApply){
        if(typeof props == "function")
          props(instance);

        else if(props)
          for(const key in instance)
            if(props.hasOwnProperty(key))
              instance[key] = (props as any)[key];

        if(!repeat)
          shouldApply = false;

        lock = true;
        instance.set().then(() => lock = false);
      }

      useModelContext(instance);

      useEffect(() => {
        lock = false;
        return () => {
          remove();
          instance.null();
        }
      }, []);

      return local;
    }
  }, []);

  return hook(apply);
}

function useModelContext(): Context;
function useModelContext(applyTo: Model): void;
function useModelContext(applyTo?: Model){
  const context = useContext(ModelContext);

  if(!applyTo || Applied.has(applyTo))
    return context;

  const pending = Expects.get(applyTo);

  if(pending){
    pending.forEach(init => init(context));
    Applied.set(applyTo, context);
    Expects.delete(applyTo);
  }
}

function getContext(from: Model){
  let waiting = Expects.get(from)!;

  if(!waiting)
    Expects.set(from, waiting = []);

  return (callback: (got: Context) => void) => {
    const applied = Applied.get(from);

    if(applied)
      callback(applied);
    else
      waiting.push(callback);
  }
}

function setContext(to: Model, context: Context){
  const pending = Expects.get(to);

  if(pending)
    pending.forEach(cb => cb(context));
}

export {
  useLocal,
  useModelContext,
  getContext,
  setContext,
  ModelContext
}