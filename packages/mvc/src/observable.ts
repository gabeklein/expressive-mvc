import { Model } from "./model";
import { control } from "./control";
import { createEffect } from "./effect";
import { Callback } from "../types";
import { defineProperties, keys } from "./helper/object";

type SelectOne<T, K extends Model.Key<T>> = K;
type SelectFew<T, K extends Model.Key<T>> = K[];

type Select<T, K extends Model.Key<T> = Model.Key<T>> = K | K[];

type Export<T, S> =
  S extends SelectOne<T, infer P> ? T[P] : 
  S extends SelectFew<T, infer P> ? Model.Export<T, P> :
  never;

type GetCallback<T, S> = (this: T, value: Export<T, S>, updated: Model.Event<T>[]) => void;

export function makeObservable(to: Observable){
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

export interface Observable {
  get(): Model.Export<this>;

  get(effect: Model.Effect<this>): Callback;

  get <P extends Select<this>> (select: P): Export<this, P>;
  get <P extends Select<this>> (select: P, callback: GetCallback<this, P>): Callback;

  set (): Promise<Model.Event<this>[]> | false;
  set (event: (key: string, value: unknown) => void | ((keys: Model.Key<this>[]) => void)): Callback;
  set (timeout: number, test?: (key: string, value: unknown) => boolean | void): Promise<Model.Event<this>[]>;

  set <T extends Model.Values<this>> (from: T, append?: boolean): Promise<Model.Event<T>[] | false>;
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
  arg1?: number | Model.Values<T> | ((key: string, value: unknown) => any),
  arg2?: boolean | ((key: string, value: unknown) => boolean | void)){

  if(typeof arg1 === "function")
    return control(this, self => (
      self.addListener(k => k && arg1(k, self.state[k]))
    ))

  const self = control(this, true);
  const { state } = self;

  if(typeof arg1 == "object") 
    for(const key in arg1){
      const value = (arg1 as any)[key];

      if(key in state){
        if(state[key] != value){
          state[key] = value;
          self.update(key);
        }
      }
      else if(arg2 === true)
        self.watch(key, { value });
    }

  return new Promise<any>((resolve, reject) => {
    if(!self.frame.size && typeof arg1 != "number")
      return resolve(false);

    const didUpdate = () => resolve(self.latest);

    const remove = self.addListener((key) => {
      if(typeof arg2 !== "function" || key && arg2(key, state[key]) === true){
        remove();

        if(timeout)
          clearTimeout(timeout);

        return didUpdate;
      }
    });

    const timeout = typeof arg1 == "number" && setTimeout(() => {
      remove();
      reject(arg1);
    }, arg1);
  });
}