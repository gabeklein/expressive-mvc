import { Control } from "./control";
import { Model } from "./model";

function use <T extends Model> (
  this: Model.New<T>,
  callback?: (instance: T) => void,
  repeat?: boolean
): T;

function use <T extends Model> (
  this: Model.New<T>,
  apply?: Model.Compat<T>,
  repeat?: boolean
): T;

function use <T extends Model> (
  this: Model.New<T>,
  arg1?: Model.Compat<T> | ((instance: T) => void),
  arg2?: boolean){

  const render = Control.use(dispatch => {
    const instance = this.new();
    const local = Control.watch(instance, () => onUpdate);
    const refresh = () => dispatch(x => x+1);

    let onUpdate: (() => void) | undefined | null;
    let apply = !!arg1;

    return {
      local,
      mount(){
        onUpdate = refresh;
        return () => {
          onUpdate = null;
          instance.null();
        }
      },
      render(props?: Model.Compat<T> | ((instance: T) => void)){
        if(apply){
          onUpdate = undefined;

          if(typeof props == "function")
            props(instance);

          else if(props)
            for(const key in instance)
              if(props.hasOwnProperty(key))
                (instance as any)[key] = (props as any)[key];

          if(!arg2)
            apply = false;

          instance.on(0).then(() => onUpdate = refresh);
        }

        return local;
      }
    }
  });

  return render(arg1);
}

export { use }