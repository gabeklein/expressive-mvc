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
    if(typeof argument == "boolean"){
      request(type, subject, model => {
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
  
    request(type, subject, model => {
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

function request<T extends Model>(
  type: Model.Type<T>, from: Model, cb: (got: T) => void){

  let map = Expects.get(from);

  if(!map)
    Expects.set(from, map = new Map());

  map.set(type, cb);
}

export { has }