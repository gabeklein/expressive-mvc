import { set } from './controller';
import { from } from './instructions';
import { issues } from './issues';
import { Model } from './model';

export const Oops = issues({
  ValueNotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`
})

type ComputeFunction<T, O = any> = (this: O, on: O) => T;

/**
 * Create suspense promise also interpretable as an error.
 * React will handle it but other contexts probably won't.
 */
function suspense(model: Model, key: string){
  const { message, stack } = Oops.ValueNotReady(model, key);
  const promise = new Promise<void>(resolve => {
    const release = model.on(key, (value: any) => {
      if(value !== undefined)
        release(), resolve();
    });
  });

  return Object.assign(promise, { message, stack });
}

export function pending<T = void>(
  source: (() => Promise<T>) | Model | typeof Model,
  compute?: ComputeFunction<T>){

  if(typeof source == "function" && !source.prototype)
    return suspendForAsync(source as any)
  else
    return from(source as any, compute,
      function getter(value, key){
        if(value === undefined)
          throw suspense(this, key);
        
        return value;
      }
    )
}

function suspendForAsync<T = void>(
  source: (key: string) => Promise<T>){

  return set(
    function suspense(key){
      let waiting = true;
      let output: any;
      let error: any;
  
      return () => {
        if(waiting){
          const issue = Oops.ValueNotReady(this.subject, key);
          const promise = source
            .call(this.subject, key)
            .catch(err => error = err)
            .then((value) => output = value)
            .finally(() => waiting = false);

          throw Object.assign(promise, {
            message: issue.message,
            stack: issue.stack
          });
        }
  
        if(error)
          throw error;
  
        return output;
      }
    }
  )
}