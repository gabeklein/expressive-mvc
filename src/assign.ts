import { Controller } from './controller';
import { apply } from './instruction';
import { issues } from './issues';
import { pendingFactory, pendingValue } from './suspense';
import { createValueEffect } from './util';

export const Oops = issues({
  NonOptional: (Parent, key) => 
    `Property ${Parent}.${key} is marked as required.`,

  BadFactory: () =>
    `Set instruction can only accept a factory or undefined.`,

  FactoryFailed: (model, key) =>
    `Generating initial value for ${model}.${key} failed.`
})

export function set(
  factory?: (key: string, subject: unknown) => any,
  argument?: Controller.OnValue | boolean): any {  

  return apply(
    function set(key){
      let set;
      let get: () => void;

      const required =
        argument === true || argument === undefined;

      if(factory === undefined)
        get = () => pendingValue(this, key);

      else if(typeof factory !== "function")
        throw Oops.BadFactory();

      else {
        get = pendingFactory(this, key, factory);

        if(required)
          try {
            get();
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

      if(typeof argument == "function")
        set = createValueEffect(argument);
      else
        set = (value: any) => {
          if(value === undefined && required)
            throw Oops.NonOptional(this.subject, key);
        }
  
      return { set, get }
    }
  )
}