import { Control, watch } from "./control";
import { Model } from "./model";

function use <T extends Model> (
  this: Model.New<T>,
  callback?: (instance: T) => void,
  repeat?: boolean
): Model.Focus<T>;

function use <T extends Model> (
  this: Model.New<T>,
  apply?: Model.Values<T>,
  repeat?: boolean
): Model.Focus<T>;

function use <T extends Model> (
  this: Model.New<T>,
  apply?: Model.Values<T> | ((instance: T) => void),
  repeat?: boolean){

  const render = Control.use(dispatch => {
    const instance = this.new();
    const local = watch(instance, () => onUpdate);
    const refresh = () => dispatch(x => x+1);

    let onUpdate: (() => void) | undefined | null;
    let shouldApply = !!apply;

    return {
      instance,
      mount(){
        onUpdate = refresh;
        return () => {
          onUpdate = null;
          instance.null();
        }
      },
      render(props?: Model.Values<T> | ((instance: T) => void)){
        if(shouldApply){
          onUpdate = undefined;

          if(typeof props == "function")
            props(instance);

          else if(props)
            for(const key in instance)
              if(props.hasOwnProperty(key))
                (instance as any)[key] = (props as any)[key];

          if(!repeat)
            shouldApply = false;

          instance.set(0).then(() => onUpdate = refresh);
        }

        return local;
      }
    }
  });

  return render(apply);
}

export { use }