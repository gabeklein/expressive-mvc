import { Control } from "./control";
import { Model } from "./model";

export function useModel <T extends Model> (
  type: Model.New<T> | (typeof Model),
  arg1?: Model.Compat<T> | ((instance: T) => void),
  arg2?: boolean){

  return (refresh: () => void) => {
    let onUpdate: (() => void) | undefined | null;
    let applyProps = typeof arg1 === "object";

    const instance = type.new();
    const proxy = Control.watch(instance, () => onUpdate);

    if(typeof arg1 == "function")
      arg1(instance);

    return {
      instance,
      commit(){
        onUpdate = refresh;
        return () => {
          onUpdate = null;
          instance.null();
        }
      },
      render(props: Model.Compat<T>){
        if(applyProps){
          onUpdate = undefined;
          applyProps = !!arg2;
  
          for(const key in props)
            if(instance.hasOwnProperty(key))
              (instance as any)[key] = (props as any)[key];
      
          instance.on(0).then(() => onUpdate = refresh);
        }

        return proxy;
      }
    }
  }
}

export function useSubscriber<T extends Model>(
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

export function useComputed<T extends Model, R>(
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