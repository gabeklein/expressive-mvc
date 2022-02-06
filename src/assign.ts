import { apply, HandleValue } from './controller';
import { issues } from './issues';
import { pendingValue } from './suspense';
import { createValueEffect, defineProperty } from './util';

export const Oops = issues({
  NonOptional: (Parent, key) => 
    `Property ${Parent}.${key} is marked as required.`,
  ValueNotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`
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

export function set(value?: any, argument?: any){
  return typeof value == "function"
    ? setFactory(value, argument)
    : setValue(value, argument)
}

export {
  set as on,
  set as memo
}

function setValue(
  value: any,
  argument?: boolean | HandleValue){

  return apply(
    function set(key){
      const get =
        value === undefined && argument !== true
          ? () => pendingValue(this, key)
          : () => this.state[key];

      let onAssign;
        
      if(typeof argument == "function")
        onAssign = createValueEffect(argument);
      else if(!argument)
        onAssign = (value: any) => {
          if(value === undefined)
            throw Oops.NonOptional(this.subject, key);
        }

      this.state[key] = value;

      return {
        get,
        set: this.setter(key, onAssign)
      }
    }
  )
}

function setFactory(waitFor: (key: string, subject: unknown) => Promise<void>, required?: boolean): true;
function setFactory(factory: (key: string, subject: unknown) => Promise<any>, required?: boolean): any;
function setFactory(factory: (key: string, subject: unknown) => any, required?: boolean): any;
function setFactory(factory: (key: string, subject: unknown) => any, required?: boolean): any {
  return apply(
    function set(key){
      const subject = this.subject;
      let waiting: undefined | Promise<any> | false;
      let value: any;
      let error: any;

      let evaluate = () => {
        try {
          const output = factory.call(subject, key, subject);

          if(output instanceof Promise){
            const issue =
              Oops.ValueNotReady(subject, key);
  
            output
              .catch(err => error = err)
              .then(out => value = out)
              .finally(() => waiting = false)
  
            waiting = Object.assign(output, {
              message: issue.message,
              stack: issue.stack
            });
          }
          else {
            value = output;
            waiting = false;
          }
        }
        catch(err){
          error = err;
          waiting = false;
          throw err;
        }
      }

      if(required !== false)
        evaluate();
  
      return () => {
        if(waiting)
          throw waiting;

        if(error)
          throw error;

        if(waiting === undefined)
          evaluate();

        return value;
      }
    }
  )
}