import { Control } from "./control";
import { Model } from "./model";

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined ? null : T;

function useContext <T extends Model> (this: Model.Class<T>): T;

/** Fetch instance of this class in passive mode. Will not subscribe to events. */
function useContext <T extends Model> (this: Model.Class<T>, ignoreUpdates?: true): T;

/** Fetch instance of this class optionally. May be undefined, but will never subscribe. */
function useContext <T extends Model> (this: Model.Class<T>, required: boolean): T | undefined;

function useContext <T extends Model, R extends []> (this: Model.Class<T>, factory: Model.GetCallback<T, R | (() => R)>, expect?: boolean): R;
function useContext <T extends Model, R extends []> (this: Model.Class<T>, factory: Model.GetCallback<T, Promise<R> | (() => R) | null>, expect?: boolean): R | null;
function useContext <T extends Model, R extends []> (this: Model.Class<T>, factory: Model.GetCallback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;

function useContext <T extends Model, R> (this: Model.Class<T>, init: Model.GetCallback<T, () => R>): NoVoid<R>;
function useContext <T extends Model, R> (this: Model.Class<T>, init: Model.GetCallback<T, (() => R) | null>): NoVoid<R> | null;

function useContext <T extends Model, R> (this: Model.Class<T>, compute: Model.GetCallback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;
function useContext <T extends Model, R> (this: Model.Class<T>, compute: Model.GetCallback<T, Promise<R>>, expect?: boolean): NoVoid<R> | null;
function useContext <T extends Model, R> (this: Model.Class<T>, compute: Model.GetCallback<T, R>, expect?: boolean): NoVoid<R>;

function useContext<T extends Model, R>(
  this: Model.Class<T>,
  arg1?: boolean | Model.GetCallback<T, any>,
  arg2?: boolean
){
  const source = Control.hasModel(this, arg1 !== false);

  if(typeof arg1 == "boolean"){
    let model!: T;
    source($ => model = $);
    return model;
  }

  return Control.getModel(arg1
    ? useComputed(source, arg1, arg2)
    : useSubscriber(source)
  )
}

export { useContext };

function useSubscriber<T extends Model>(
  source: (callback: (got: T) => void) => void){

  return (refresh: () => void) => {
    let onUpdate: (() => void) | undefined;
    let proxy!: T;

    source(got => {
      proxy = Control.watch(got, () => onUpdate);
    })

    return {
      commit(){
        onUpdate = refresh;
        return () =>
          onUpdate = undefined;
      },
      render: () => proxy
    }
  }
}

function useComputed<T extends Model, R>(
  source: (callback: (got: T) => void) => void,
  compute: Model.GetCallback<T, any>,
  required?: boolean){

  return (refresh: () => void) => {
    let suspense: (() => void) | undefined;
    let onUpdate: (() => void) | undefined | null;
    let value: R | undefined;

    let getValue: (() => R | undefined) | undefined;
    let factory: true | undefined;
    let proxy!: T;

    source(got => {
      proxy = Control.watch(got, () => factory ? null : onUpdate);
      getValue = () => compute.call(proxy, proxy, forceUpdate);
      value = getValue();

      function forceUpdate(): void;
      function forceUpdate<T>(passthru: Promise<T> | (() => Promise<T>)): Promise<T>;
      function forceUpdate<T>(passthru?: Promise<T> | (() => Promise<T>)){
        if(typeof passthru == "function")
          passthru = passthru();
  
        if(getValue)
          didUpdate(getValue());
        else
          refresh();
  
        if(passthru)
          return passthru.finally(refresh);
      }
    })

    if(value === null){
      getValue = undefined;
      onUpdate = null;
      return;
    }

    if(typeof value == "function"){
      const get = value;
      
      Control.watch(proxy, () => onUpdate);

      factory = true;
      compute = () => get();
      value = get();
    }

    const didUpdate = (got: any) => {
      value = got;

      if(suspense){
        suspense();
        suspense = undefined;
      }
      else
        refresh();
    };

    if(value instanceof Promise){
      onUpdate = null;
      value.then(didUpdate);
      value = undefined;
    }
    else
      onUpdate = () => {
        const next = getValue!();

        if(notEqual(value, next))
          didUpdate(next);
      };

    return {
      commit: () => () => {
        onUpdate = null;
      },
      render: () => {
        if(value !== undefined)
          return value;
  
        if(required)
          throw new Promise<void>(res => {
            suspense = res;
          });
  
        return null;
      }
    }
  }
}

/** Values are not equal for purposes of a refresh. */
const notEqual = <T>(a: T, b: unknown) => (
  b !== a && (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length !== b.length ||
    a.some((x, i) => x !== b[i])
  )
)