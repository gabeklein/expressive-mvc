import { apply, HandleValue } from './controller';
import { issues } from './issues';
import { pendingValue } from './suspense';
import { createValueEffect, defineProperty } from './util';

export const Oops = issues({
  NonOptional: (Parent, key) => 
    `Property ${Parent}.${key} is marked as required.`,

  ValueNotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`,

  BadFactory: () =>
    `Set instruction can only accept a factory or undefined.`
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
      const subject = this.subject;
      let waiting: undefined | Promise<any> | false;
      let error: any;

      let onSet;
      let onGet: () => void;

      const required =
        argument === true || argument === undefined;

      if(factory === undefined)
        onGet = () => pendingValue(this, key);

      else if(typeof factory == "function"){
        const evaluate = () => {
          try {
            const output = factory!.call(subject, key, subject);
  
            if(output instanceof Promise){
              const issue =
                Oops.ValueNotReady(subject, key);
    
              output
                .catch(err => error = err)
                .then(out => this.state[key] = out)
                .finally(() => waiting = false)
    
              waiting = Object.assign(output, {
                message: issue.message,
                stack: issue.stack
              });
            }
            else {
              this.state[key] = output;
              waiting = false;
            }
          }
          catch(err){
            error = err;
            waiting = false;
            throw err;
          }
        }

        if(required)
          evaluate();

        onGet = () => {
          if(waiting)
            throw waiting;
  
          if(error)
            throw error;
  
          if(waiting === undefined)
            evaluate();
  
          return this.state[key];
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

export {
  set,
  set as on,
  set as memo
}