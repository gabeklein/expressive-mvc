import { Control } from "./control";
import { Model } from "./model";

function use <T extends Model> (
  this: Model.New<T>,
  callback?: (instance: T) => void
): T;

function use <T extends Model> (
  this: Model.New<T>,
  apply?: Model.Compat<T>,
  repeat?: boolean
): T;

function use <T extends Model> (
  this: Model.New<T> | (typeof Model),
  arg1?: Model.Compat<T> | ((instance: T) => void),
  arg2?: boolean){

  return Control.useModel((refresh: () => void) => {
    let onUpdate: (() => void) | undefined | null;
    let applyProps = typeof arg1 === "object";

    const instance = this.new();
    const proxy = Control.watch(instance, () => onUpdate);

    if(typeof arg1 == "function")
      arg1(instance);

    return {
      instance,
      mount(){
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
  }, arg1 as Model.Compat<T>)
}

export { use }