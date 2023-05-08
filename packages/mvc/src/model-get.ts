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

function get<T extends Model, R>(
  this: Model.Type<T>,
  arg1?: boolean | Model.GetCallback<T, any>,
  arg2?: boolean
){
  return Control.get(this, (refresh, context) => {
    let onUpdate: (() => void) | undefined | null;
    let value: any;

    if(typeof arg1 !== "function"){
      context(got => {
        if(got)
          value = arg1 === undefined
            ? Control.watch(got, () => onUpdate)
            : got;
        else if(arg1 !== false)
          throw Oops.NotFound(this);
      })
  
      return {
        mount(){
          onUpdate = refresh;
          return () => onUpdate = null;
        },
        render: () => value
      };
    }

    let compute = arg1;
    let suspense: (() => void) | undefined;
    let getValue: (() => R | undefined) | undefined;
    let factory: true | undefined;
    let proxy!: T;

    context(got => {
      if(!got)
        throw Oops.NotFound(this);

      proxy = Control.watch(got as T, () => factory ? null : onUpdate);
      getValue = () => compute.call(proxy, proxy, forceUpdate);
      value = getValue();

      function forceUpdate(): void;
      function forceUpdate<T>(action: Promise<T> | (() => Promise<T>)): Promise<T>;
      function forceUpdate<T>(action?: Promise<T> | (() => Promise<T>)){
        if(typeof action == "function")
          action = action();
  
        if(getValue)
          didUpdate(getValue());
        else
          refresh();
  
        if(action)
          return action.finally(refresh);
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
  
        if(arg2)
          throw new Promise<void>(res => {
            suspense = res;
          });
  
        return null;
      }
    }
  })
}

export { get };

/** Values are not equal for purposes of a refresh. */
const notEqual = <T>(a: T, b: unknown) => (
  b !== a && (
    !Array.isArray(a) ||
    !Array.isArray(b) ||
    a.length !== b.length ||
    a.some((x, i) => x !== b[i])
  )
)