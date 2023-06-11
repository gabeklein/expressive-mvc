import { Model } from "./model";
import { control } from "./control";
import { createEffect } from "./effect";
import { Callback } from "../types";
import { keys } from "./helper/object";

type SelectOne<T, K extends Model.Key<T>> = K;
type SelectFew<T, K extends Model.Key<T>> = K[];

type Select<T, K extends Model.Key<T> = Model.Key<T>> = K | K[];

type Export<T, S> =
  S extends SelectOne<T, infer P> ? T[P] : 
  S extends SelectFew<T, infer P> ? Model.Export<T, P> :
  never;

type OnUpdate<T, S> = (this: T, value: Export<T, S>, updated: Model.Event<T>[]) => void;

export interface Observable {
  get(): Model.Export<this>;

  get <P extends Select<this>> (select: P): Export<this, P>;
  get <P extends Select<this>> (select: P, onUpdate: OnUpdate<this, P>, once?: true): Callback;
  get <P extends Select<this>> (select: P, onUpdate: OnUpdate<this, P>, initial?: false): Callback;

  get(effect: Model.Effect<this>): Callback;

  set (): Promise<Model.Event<this>[]>;
  set (timeout: number): Promise<Model.Event<this>[] | false>;

  set <T extends Model.Values<this>> (from: T, only?: (keyof T)[]): Promise<Model.Event<T>[] | false>;

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

    if(once === undefined)
      invoke();

  const remove = self.addListener(key => {
    if(!select || select.includes(key as P)){
      if(once)
        remove();

      return invoke;
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