import { Context, Control, Model } from '@expressive/mvc';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const Applied = new WeakMap<Model, Context>();
const Expects = new WeakMap<Model, ((context: Context) => void)[]>();
const Shared = createContext(new Context());

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

      useModelContext(instance);

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

function useModelContext(): Context;
function useModelContext(applyTo: Model): void;
function useModelContext(applyTo?: Model){
  const context = useContext(Shared);

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
  Shared
}