import { Model } from "./model";
import { control } from "./control";
import { createEffect } from "./effect";
import { Callback } from "../types";
import { keys } from "./helper/object";

type SelectOne<T, K extends Model.Key<T>> = K;
type SelectFew<T, K extends Model.Key<T>> = K[];

type Select<T, K extends Model.Key<T> = Model.Key<T>> = K | K[];
type Event<T> = Model.Event<T> | (Model.Event<T>)[];

type Export<T, S> =
  S extends SelectOne<T, infer P> ? T[P] : 
  S extends SelectFew<T, infer P> ? Model.Export<T, P> :
  never;

type GetCallback<T, S> = (this: T, value: Export<T, S>, updated: Model.Event<T>[]) => void;
type OnCallback<T> = (this: T, updated: Model.Event<T>[]) => void;

export interface Observable {
  get(): Model.Export<this>;

  get <P extends Select<this>> (select: P): Export<this, P>;
  get <P extends Select<this>> (select: P, callback: GetCallback<this, P>): Callback;

  // /** @deprecated use `on` instead */
  // get <P extends Select<this>> (select: P, callback: GetCallback<this, P>, once: true): Callback;
  // /** @deprecated use `on` instead */
  // get <P extends Select<this>> (select: P, callback: GetCallback<this, P>, initial: false): Callback;

  on(effect: Model.Effect<this>): Callback;

  on (timeout?: number): Promise<Model.Event<this>[]>;

  on (select: Event<this>, timeout?: number): Promise<Model.Event<this>[]>;
  on (select: Event<this>, callback: OnCallback<this>, once?: boolean): Callback;

  // /** @deprecated use `on` instead */
  // set (timeout: 0): Promise<Model.Event<this>[]>;
  // /** @deprecated use `on` instead */
  // set (timeout?: number): Promise<Model.Event<this>[]>;

  set <K extends Model.Event<this>> (key: K): Promise<Model.Event<this>[]>;
  set <K extends Model.Key<this>> (key: K, value: Model.Value<this[K]>): Promise<Model.Event<this>[] | false>;

  set <T extends Model.Values<this>> (from: T, only?: (keyof T)[]): Promise<Model.Event<T>[] | false>;
}

export function onMethod <T extends Model> (
  this: T,
  arg?: number | Event<T> | Model.Effect<T>,
  arg2?: Function | number,
  once?: boolean){

  if(typeof arg == "function")
    return createEffect(this, arg);

  if(typeof arg2 == "function")
    return control(this, self => {
      const select =
        typeof arg == "string" ? [arg] :
        typeof arg == "object" ? arg : undefined;

      const remove = self.addListener(key => {
        if(select && !select.includes(key!))
          return;

        if(once)
          remove();

        return () => arg2.call(this, self.latest);
      });   
      
      return remove;
    })

  return new Promise((res, rej) => {
    const timeout = typeof arg == "number" ? arg : arg2 as number;
    const remove = onMethod.call(this, arg, res, true) as Callback;

    if(typeof timeout == "number")
      setTimeout(() => {
        remove();
        rej(timeout);
      }, timeout);
  })
}

export function getMethod <T extends Model, P extends Model.Key<T>> (
  this: T,
  argument?: P | P[] | Model.Effect<T>,
  callback?: Function,
  once?: boolean){

  if(typeof argument == "function")
    throw new Error("This overload is deprecated - use `on` instead");

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
  arg1?: Model.Event<T> | Model.Values<T>,
  arg2?: any){

  const self = control(this, true);
  const { state } = self;
  let timeout: number | undefined = 0;

  const set = (key: string, value: any) => {
    if(state[key] != value){
      state[key] = value;
      self.update(key);
    }
  }

  switch(typeof arg1){
    case "string":
      if(1 in arguments)
        if(arg1 in state){
          set(arg1, arg2);
          break;
        }
        else
          self.watch(arg1, { value: arg2 });

      self.update(arg1);
    break;

    case "object":
      for(const key in state)
        if(key in arg1 && (!arg2 || arg2.includes(key)))
          set(key, (arg1 as any)[key]);
    break;

    default:
      timeout = arg1;
  }

  return new Promise<any>((resolve, reject) => {
    if(!self.frame.size && timeout === 0)
      return resolve(false);

    const remove = self.addListener(() => {
      remove();
      return () => resolve(self.latest);
    });

    if(timeout as number > 0)
      setTimeout(() => {
        remove();
        reject(timeout);
      }, timeout);
  });
}