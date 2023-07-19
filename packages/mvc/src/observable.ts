import { Model } from "./model";
import { control } from "./control";
import { createEffect } from "./effect";
import { Callback } from "../types";
import { defineProperties, keys } from "./helper/object";

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

export function makeObservable(to: Observable){
  defineProperties(to, {
    on: { value: onMethod },
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

export interface Observable {
  get(): Model.Export<this>;

  get(effect: Model.Effect<this>): Callback;

  get <P extends Select<this>> (select: P): Export<this, P>;
  get <P extends Select<this>> (select: P, callback: GetCallback<this, P>): Callback;

  on (select: Event<this>, timeout?: number): Promise<Model.Event<this>[]>;
  on (select: Event<this>, callback: OnCallback<this>, once?: boolean): Callback;

  set (): Promise<Model.Event<this>[]> | false;
  set (timeout: number): Promise<Model.Event<this>[]>;

  set <T extends Model.Values<this>> (from: T, append?: boolean): Promise<Model.Event<T>[] | false>;
}

function onMethod <T extends Model> (
  this: T,
  arg?: number | Event<T>,
  arg2?: Function | number,
  once?: boolean){

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

function getMethod <T extends Model, P extends Model.Key<T>> (
  this: T,
  argument?: P | P[] | Model.Effect<T>,
  callback?: Function){

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

  invoke();

  return self.addListener(key => {
    if(!select || select.includes(key as P)){
      return invoke;
    }
  });
}

function setMethod <T extends Model>(
  this: T,
  arg1?: number | Model.Event<T> | Model.Values<T>,
  arg2?: any){

  const self = control(this, true);
  const { state } = self;
  let timeout: number | undefined;

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
    if(!self.frame.size && timeout === undefined)
      return resolve(false);

    const remove = self.addListener(() => {
      remove();
      return () => resolve(self.latest);
    });

    if(typeof timeout == "number")
      setTimeout(() => {
        if(!self.frame.size){
          remove();
          reject(timeout);
        }
      }, timeout);
  });
}