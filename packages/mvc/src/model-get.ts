import { Control } from "./control";
import { issues } from "./helper/issues";
import { Model } from "./model";

export const Oops = issues({
  NotFound: (name) => `Could not find ${name} in context.`
})

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined ? null : T;

function get <T extends Model> (this: Model.Type<T>): T;

/** Fetch instance of this class in passive mode. Will not subscribe to events. */
function get <T extends Model> (this: Model.Type<T>, ignoreUpdates?: true): T;

/** Fetch instance of this class optionally. May be undefined, but will never subscribe. */
function get <T extends Model> (this: Model.Type<T>, required: boolean): T | undefined;

function get <T extends Model, R extends []> (this: Model.Type<T>, factory: Model.GetCallback<T, R | (() => R)>, expect?: boolean): R;
function get <T extends Model, R extends []> (this: Model.Type<T>, factory: Model.GetCallback<T, Promise<R> | (() => R) | null>, expect?: boolean): R | null;
function get <T extends Model, R extends []> (this: Model.Type<T>, factory: Model.GetCallback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;

function get <T extends Model, R> (this: Model.Type<T>, init: Model.GetCallback<T, () => R>): NoVoid<R>;
function get <T extends Model, R> (this: Model.Type<T>, init: Model.GetCallback<T, (() => R) | null>): NoVoid<R> | null;

function get <T extends Model, R> (this: Model.Type<T>, compute: Model.GetCallback<T, Promise<R> | R>, expect: true): Exclude<R, undefined>;
function get <T extends Model, R> (this: Model.Type<T>, compute: Model.GetCallback<T, Promise<R>>, expect?: boolean): NoVoid<R> | null;
function get <T extends Model, R> (this: Model.Type<T>, compute: Model.GetCallback<T, R>, expect?: boolean): NoVoid<R>;

function get<T extends Model>(
  this: Model.Type<T>,
  arg1?: boolean | Model.GetCallback<T, any>,
  arg2?: boolean
){
  if(typeof arg1 == "boolean")
    return Control.tapModel(this, got => {
      if(got)
        return got;

      if(arg1)
        throw Oops.NotFound(this);
    });

  return arg1
    ? useComputed(this, arg1, arg2)
    : useSubscriber(this, arg1 !== false)
}

export { get };

function useSubscriber<T extends Model>(
  type: Model.Type<T>, required?: boolean){

  return Control.getModel(type, (refresh, context) => {
    let onUpdate: (() => void) | undefined;
    let proxy!: T;

    context(got => {
      if(got)
        proxy = Control.watch(got as T, () => onUpdate);

      else if(required)
        throw Oops.NotFound(type);
    })

    return {
      mount(){
        onUpdate = refresh;
        return () =>
          onUpdate = undefined;
      },
      render: () => proxy
    }
  })
}

function useComputed<T extends Model, R>(
  type: Model.Type<T>,
  compute: Model.GetCallback<T, any>,
  required?: boolean){

  return Control.getModel(type, (refresh, context) => {
    let suspense: (() => void) | undefined;
    let onUpdate: (() => void) | undefined | null;
    let value: R | undefined;

    let getValue: (() => R | undefined) | undefined;
    let factory: true | undefined;
    let proxy!: T;

    context(got => {
      if(!got)
        throw Oops.NotFound(type);

      proxy = Control.watch(got as T, () => factory ? null : onUpdate);
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
      mount: () => () => {
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
  });
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