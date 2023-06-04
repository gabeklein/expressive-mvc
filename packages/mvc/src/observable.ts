import { Model } from "./model";
import { control } from "./control";
import { createEffect } from "./effect";
import { Callback } from "../types";
import { keys } from "./helper/object";

type OnValue<T, P extends Model.Key<T>> = (this: T, value: T[P], updated: Model.Event<T>[]) => void;
type OnValues<T, P extends Model.Key<T>> = (this: T, value: Model.Export<T, P>, updated: Model.Event<T>[]) => void;

export interface Observable {
  get(): Model.Export<this>;

  get(effect: Model.Effect<this>): Callback;

  get <P extends Model.Key<this>> (select: P): this[P];
  get <P extends Model.Key<this>> (select: P, onUpdate: OnValue<this, P>, once?: boolean): Callback;

  get <P extends Model.Key<this>> (select: P[]): Model.Export<this, P>;
  get <P extends Model.Key<this>> (select: P[], onUpdate: OnValues<this, P>, once?: boolean): Callback;

  set (): Promise<Model.Event<this>[]>;
  set (timeout: number): Promise<Model.Event<this>[] | false>;

  set <T extends Model.Values<this>> (source: T, only?: (keyof T)[]): Promise<Model.Event<T>[] | false>;

  set <K extends Model.Key<this>> (key: K, value: Model.Value<this[K]>): Promise<Model.Event<this>[] | false>;
  set <K extends Model.Event<this>> (key: K): Promise<Model.Event<this>[] | false>;
}

export function getMethod <T extends Model, P extends Model.Key<T>> (
  this: T,
  argument?: P | P[] | Model.Effect<T>,
  callback?: Function,
  once?: boolean){

  if(typeof argument == "function")
    return createEffect(this, argument);

  const self = control(this, true);

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

  const remove = self.addListener(key => {
    if(!select || select.includes(key as P)){
      if(once)
        remove();

      return () => callback(extract(), self.latest);
    }
  });

  return remove;
}

export function setMethod <T extends Model>(
  this: T,
  arg1?: number | Model.Event<T> | Model.Values<T>,
  arg2?: any){

  const self = control(this, true);
  const { state } = self;
  let timeout: number | undefined = 0;

  switch(typeof arg1){
    case "string":
      if(1 in arguments)
        if(arg1 in state)
          state[arg1] = arg2;
        else
          self.watch(arg1, { value: arg2 });

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