import { Expects } from '../context';
import { Model } from '../model';
import { add } from './add';

type Callback<T = any> = (model: T) => void | boolean | (() => void);

function has <T extends Model> (type: Model.Type<T>, one: true): T;
function has <T extends Model> (type: Model.Type<T>, required: boolean): T | undefined;
function has <T extends Model> (type: Model.Type<T>, arg?: Callback<T>): Set<T>;
  
function has <T extends Model> (
  type: Model.Type<T>,
  argument?: boolean | Callback<T>){

  return add<T>((key, subject, state) => {
    let map = Expects.get(subject);
  
    if(!map)
      Expects.set(subject, map = new Map());

    if(typeof argument == "boolean"){
      map.set(type, (model: T) => {
        const remove = () => {
          drop();

          if(state[key] === model)
            delete state[key];
        }

        // if(state[key])
        //   throw new Error(`Tried to register new ${model.constructor} in ${subject}.${key} but one already exists.`);
        
        subject.set(key as any, model);
        const drop = model.get(null, remove);

        return remove;
      });

      return { get: argument }
    }

    const children = new Set<T>();
  
    map.set(type, (model: T) => {
      if(children.has(model))
        return;

      const remove = typeof argument == "function"
        ? argument(model)
        : undefined;

      if(remove === false)
        return;

      children.add(model);
      subject.set(key);
      
      const done = () => {
        drop();

        if(typeof remove == "function")
          remove();

        children.delete(model);
        subject.set(key);
      }

      const drop = model.get(null, done);

      return done;
    });

    return {
      value: children
    }
  })
}

export { has }