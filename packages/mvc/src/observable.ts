import { Model } from "./model";
import { control } from "./control";
import { createEffect } from "./effect";
import { Callback } from "../types";

export interface Observable {
  get(): Model.Export<this>;

  get(effect: Model.Effect<this>): Callback;

  get <P extends Model.Key<this>> (select: P): this[P];
  get <P extends Model.Key<this>> (select: Iterable<P>): Model.Get<this, P>;

  get <P extends Model.Key<this>> (select: P, listener: (this: this, value: this[P]) => void, once?: boolean): Callback;
  get <P extends Model.Key<this>> (select: Iterable<P>, listener: (this: this, value: Model.Get<this, P>) => void, once?: boolean): Callback;

  set (): Promise<Model.Event<this>[]>;
  set (timeout: number): Promise<Model.Event<this>[] | false>;

  set <T extends Model.Compat<this>> (source: T, only?: (keyof T)[]): Promise<Model.Key<T>[]>;
  set <K extends Model.Event<this>> (key: K, value?: Model.ValueOf<this, K>): Promise<Model.Event<this>[] | false>;
}

export function getMethod <T extends Model, P extends Model.Key<T>> (
  this: T,
  argument?: P | P[] | Model.Effect<T>,
  callback?: Function,
  once?: boolean){

  if(typeof argument == "function")
    return createEffect(this, argument);

  const self = control(this, true);

  function get(){
    if(typeof argument == "string")
      return self.state[argument];

    if(!argument)
      return { ...self.state };

    const output = {} as any;

    for(const key of argument as P[])
      output[key] = self.state[key];

    return output;
  }

  if(typeof callback != "function")
    return get();

  const select = typeof argument == "string" ? [argument] : argument;

  if(select)
    for(const key of select)
      try {
        void self.subject[key];
      }
      catch(e){
        // TODO: should this be caught?
      }

  const remove = self.addListener(key => {
    if(!select || select.includes(key as P)){
      if(once)
        remove();

      return () => callback(get());
    }
  });

  return remove;
}

export function setMethod <T extends Model>(
  this: T,
  arg1?: number | Model.Event<T> | Model.Compat<T>,
  arg2?: any){

  const self = control(this, true);
  const { state } = self;
  let timeout: number | undefined = 0;

  switch(typeof arg1){
    case "string":
      if(1 in arguments && arg1 in state)
        state[arg1] = arg2;

      self.update(arg1);
    break;

    case "object":
      for(const key in state)
        if(key in arg1 && (!arg2 || arg2.includes(key))){
          state[key] = (arg1 as any)[key];
          self.update(key);
        }
    break;

    default:
      timeout = arg1;
  }

  return new Promise<any>((resolve) => {
    if(!self.frame.size && timeout === 0)
      resolve(false);
      
    const remove = self.addListener(() => {
      remove();
      return () => resolve(self.latest);
    });

    if(timeout as number > 0)
      setTimeout(() => {
        remove();
        resolve(false);
      }, timeout);
  });
}