import { Control, control } from './control';
import { createEffect } from './effect';
import { defineProperties, keys } from './helper/object';
import { Model } from './model';

export function makeObservable(to: Model.Observable){
  defineProperties(to, {
    get: { value: getMethod },
    set: { value: setMethod },
    toString: {
      configurable: true,
      value(){
        return `${this.constructor.name}-${control(this).id}`;
      }
    }
  });
}

function getMethod <T extends Model, P extends Model.Key<T>> (
  this: T,
  argument?: P | P[] | Model.Effect<T>,
  callback?: Function){

  return typeof argument == "function"
    ? createEffect(this, argument)
    : extract(this, argument, callback);
}

function extract <T extends Model, P extends Model.Key<T>> (
  target: T,
  argument?: P | P[],
  callback?: Function){

  const self = control(target, true);

  function get(key: P){
    const value = self.state[key];
    return value instanceof Model ? value.get() : value;
  }

  const extract = typeof argument == "string"
    ? () => get(argument)
    : () => {
      const output = {} as any;

      for(const key of argument || keys(self.state))
        output[key] = get(key as P);

      return output;
    };

  if(typeof callback != "function")
    return extract();

  const select = typeof argument == "string" ? [argument] : argument;
  const invoke = () => callback(extract(), self.latest || []);

  if(select)
    for(const key of select)
      try {
        const value = self.subject[key];

        if(!(key in self.state))
          self.watch(key, { value });
      }
      catch(e){
        // TODO: should this be caught?
      }

  invoke();

  return self.addListener(key => {
    if(!select || select.includes(key as P)){
      return invoke;
    }
  });
}

function setMethod <T extends Model>(
  this: T,
  arg1?: number | Model.Values<T> | ((key: string, value: unknown) => any),
  arg2?: boolean | ((key: string, value: unknown) => boolean | void)){

  return typeof arg1 == "function"
    ? control(this, self => (
      self.addListener(k => k && arg1(k, self.state[k]))
    ))
    : update(this, arg1, arg2);
}

function update<T extends Model>(
  target: T,
  arg1?: number | Model.Values<T>,
  arg2?: boolean | ((key: string, value: unknown) => boolean | void)){

  return new Promise<any>((resolve, reject) => {
    control(target, self => {
      if(typeof arg1 == "object")
        merge(self, arg1, arg2 === true);

      if(!self.frame.size && typeof arg1 != "number"){
        resolve(false);
        return;
      }
  
      const callback = () => resolve(self.latest);
  
      const remove = self.addListener((key) => {
        if(typeof arg2 !== "function" || key && arg2(key, self.state[key]) === true){
          remove();
  
          if(timeout)
            clearTimeout(timeout);
  
          return callback;
        }
      });
  
      const timeout = typeof arg1 == "number" && setTimeout(() => {
        remove();
        reject(arg1);
      }, arg1);
    })
  });
}


function merge<T extends Model>(
  into: Control<T>,
  data: Model.Values<T>,
  append?: boolean){

  const { state } = into;

  for(const key in data){
    const value = (data as any)[key];

    if(key in state){
      if(state[key] != value){
        state[key] = value;
        into.update(key);
      }
    }
    else if(append)
      into.watch(key, { value });
  }
}