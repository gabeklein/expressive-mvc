import { apply, HandleValue } from './controller';
import { issues } from './issues';
import { pendingFactory, pendingValue } from './suspense';
import { createValueEffect, defineProperty } from './util';

export const Oops = issues({
  NonOptional: (Parent, key) => 
    `Property ${Parent}.${key} is marked as required.`,

  ValueNotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`,

  BadFactory: () =>
    `Set instruction can only accept a factory or undefined.`,

  FactoryFailed: (model, key) =>
    `Generating initial value for ${model}.${key} failed.`
})

export function lazy<T>(value: T): T {
  return apply(
    function lazy(key){
      const source = this.subject as any;

      source[key] = value;
      defineProperty(this.state, key, {
        get: () => source[key]
      });
    }
  );
}

function set(
  factory?: (key: string, subject: unknown) => any,
  argument?: HandleValue | boolean): any {  

  return apply(
    function set(key){
      let onSet;
      let onGet: () => void;

      const required =
        argument === true || argument === undefined;

      if(factory === undefined)
        onGet = () => pendingValue(this, key);

      else if(typeof factory == "function"){
        onGet = pendingFactory.call(this, factory, key)

        if(required)
          try {
            onGet();
          }
          catch(err){
            if(err instanceof Promise)
              void 0;
            else {
              Oops.FactoryFailed(this.subject, key).warn();
              throw err;
            }
          }
      }
      else
        throw Oops.BadFactory();

      if(typeof argument == "function")
        onSet = createValueEffect(argument);
      else if(required)
        onSet = (value: any) => {
          if(value === undefined)
            throw Oops.NonOptional(this.subject, key);
        }
  
      return {
        set: this.setter(key, onSet),
        get: onGet
      }
    }
  )
}

function on(initial: any, onUpdate: HandleValue){
  return set(initial && (() => initial), onUpdate)
}

export {
  on,
  set,
  set as memo
}