import { Control } from "./control";
import { issues } from "./helper/issues";
import { Model } from "./model";

export const Oops = issues({
  NotFound: (name) => `Could not find ${name} in context.`
})

/** Type may not be undefined - instead will be null.  */
type NoVoid<T> = T extends undefined | void ? null : T;

type ForceUpdate = {
  /** Force an update in current component. */
  (): void;
  
  /**
   * Force an update and again after promise either resolves or rejects.
   * Will return a duplicate of given Promise, which resolves after refresh.
   */
  <T = void>(passthru: Promise<T>): Promise<T>

  /**
   * Force a update while calling async function.
   * A refresh will occur both before and after given function.
   * Any actions performed before first `await` will occur before refresh!
   */
  <T = void>(invoke: () => Promise<T>): Promise<T>
};

type Factory<T extends Model, R> =
  (this: T, current: T, update: ForceUpdate) => R;

/** Fetch instance of this class from context. */
function get <T extends Model> (this: Model.Type<T>, ignoreUpdates?: true): Model.Focus<T>;

/** Fetch instance of this class optionally. May be undefined, but will never subscribe. */
function get <T extends Model> (this: Model.Type<T>, required: boolean): Model.Focus<T> | undefined;

function get <T extends Model, R> (this: Model.Type<T>, factory: Factory<T, (() => R) | R | Promise<R>>): NoVoid<R>;
function get <T extends Model, R> (this: Model.Type<T>, factory: Factory<T, (() => R) | null>): NoVoid<R> | null;

function get<T extends Model, R>(
  this: Model.Type<T>,
  argument?: boolean | Factory<T, any>
){
  return Control.get((dispatch, context) => {
    const refresh = () => dispatch(x => x+1);
    let onUpdate: (() => void) | undefined | null;
    let value: any;

    if(typeof argument !== "function"){
      const got = context.get(this);

      if(got)
        value = argument === undefined
          ? Control.watch(got, k => k ? onUpdate : undefined)
          : got;
      else if(argument !== false)
        throw Oops.NotFound(this);

      return {
        mount(){
          onUpdate = refresh;
          return () => onUpdate = null;
        },
        render: () => value
      };
    }

    let compute = argument;
    let suspense: (() => void) | undefined;
    let getValue: (() => R | undefined) | undefined;
    let factory: true | undefined;
    let proxy!: T;

    const found = context.get(this);

    if(!found)
      throw Oops.NotFound(this);

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

    function didUpdate(got: any){
      value = got;

      if(suspense){
        suspense();
        suspense = undefined;
      }
      else
        refresh();
    };

    proxy = Control.watch(found, () => factory ? null : onUpdate);
    getValue = () => compute.call(proxy, proxy, forceUpdate);
    value = getValue();

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

    if(value instanceof Promise){
      onUpdate = null;
      value.then(didUpdate);
      value = undefined;
    }
    else
      onUpdate = () => {
        const next = getValue!();

        if(value !== next)
          didUpdate(next);
      };

    return {
      mount: () => () => {
        onUpdate = null;
      },
      render: () => {
        if(value !== undefined)
          return value;
  
        if(onUpdate)
          return null;

        throw new Promise<void>(res => {
          suspense = res;
        });  
      }
    }
  })
}

export { get };