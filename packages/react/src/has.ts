import { Context, add } from '@expressive/mvc';

import { Model } from '.';

type RegisterCallback<T = any> = (model: T) => void | boolean | (() => void);

const Expects = new WeakMap<Model, Map<Model.Type, RegisterCallback>>();
const Downstream = new WeakMap<Model.Type, symbol>();

export function has <T extends Model> (type: Model.Type<T>, one: true): T;
export function has <T extends Model> (type: Model.Type<T>, required: boolean): T | undefined;
export function has <T extends Model> (type: Model.Type<T>, arg?: RegisterCallback<T>): Set<T>;
  
export function has <T extends Model> (
  type: Model.Type<T>,
  arg?: boolean | RegisterCallback<T>){

  return add<T>((key, subject, state) => {
    let map = Expects.get(subject);
  
    if(!map)
      Expects.set(subject, map = new Map());

    if(typeof arg == "boolean"){
      map.set(type, (model: T) => {
        // if(state[key])
        //   throw new Error(`Tried to register new ${model.constructor} in ${subject}.${key} but one already exists.`);
        
        subject.set(key as any, model);
  
        model.get(null, () => {
          if(state[key] === model)
            delete state[key];
        })
      });

      return {
        get: arg
      }
    }

    const children = new Set<T>();
  
    map.set(type, (model: T) => {
      if(children.has(model))
        return;

      const remove = typeof arg == "function" ? arg(model) : undefined;

      if(remove === false)
        return;

      children.add(model);
      subject.set(key);

      model.get(null, () => {
        if(typeof remove == "function")
          remove();

        children.delete(model);
        subject.set(key);
      })
    });

    return {
      value: children
    }
  })
}

export function apply(model: Model, context: Context){
  const key = Downstream.get(model.constructor as Model.Type);
  const callback = key && (context as any)[key];

  if(callback)
    callback(model);
}

export function inject(model: Model, context: Context){
  const expects = Expects.get(model);

  if(!expects)
    return;

  for(let [T, callback] of expects)
    do {
      let key = Downstream.get(T);
  
      if(!key){
        key = Symbol(T.name);
        Downstream.set(T, key);
      }

      const value = context.hasOwnProperty(key) ? null : callback;
  
      if(value || (context as any)[key] !== callback)
        Object.defineProperty(context, key, {
          configurable: true,
          value
        });
  
      T = Object.getPrototypeOf(T);
    }
    while(T !== Model);
}