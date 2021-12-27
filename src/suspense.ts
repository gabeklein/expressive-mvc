import { apply, Controller, manage } from './controller';
import { from } from './instructions';
import { issues } from './issues';
import { Model } from './model';

export const Oops = issues({
  ValueNotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`
})

type ComputeFunction<T, O = any> = (this: O, on: O) => T;

export function pending<T = void>(
  source: (() => Promise<T>) | Model | typeof Model,
  compute?: ComputeFunction<T>){

  return (
    source === undefined ?
      suspendForValue() :
    typeof source == "function" && !source.prototype ?
      suspendForAsync(source as any) :
      suspendForComputed(source as any, compute)
  )
}

/**
 * Get value, suspend instead if undefined.
 * 
 * Throws suspense promise also interpretable as an error.
 * React could handle it but other contexts probably not.
 */
function pendingValue<T = any>(
  via: Controller, key: string): T {

  const value = via.state[key];

  if(value !== undefined)
    return value;

  const error =
    Oops.ValueNotReady(via.subject, key);

  const promise = new Promise<void>(resolve => {
    const release = via.addListener(forKey => {
      if(forKey == key)
        return () => {
          if(via.state[key] !== undefined){
            release();
            resolve();
          }
        }
    });
  });

  throw Object.assign(promise, {
    toString: () => String(error),
    message: error.message,
    stack: error.stack
  });
}

function suspendForComputed<T>(
  source: Model | typeof Model,
  compute?: ComputeFunction<T>){

  function getter(
    this: Model, _value: any, key: string){

    return pendingValue(manage(this), key);
  }

  return from(source, compute, getter);
}

function suspendForValue<T = void>(){
  return apply<T>(
    function pending(key){
      this.state[key] = undefined;

      return {
        set: this.setter(key),
        get: () => pendingValue(this, key)
      }
    }
  )
}

function suspendForAsync<T = void>(
  source: (key: string) => Promise<T>){

  return apply(
    function suspense(key){
      const subject = this.subject as Model
      let waiting = true;
      let value: any;
      let error: any;
  
      return () => {
        if(error)
          throw error;

        if(!waiting)
          return value;

        const issue =
          Oops.ValueNotReady(subject, key);

        let suspend = source
          .call(subject, key)
          .catch(err => error = err)
          .then(out => value = out)
          .finally(() => waiting = false);
  
        throw Object.assign(suspend, {
          message: issue.message,
          stack: issue.stack
        });
      }
    }
  )
}