import { Model } from '../model';
import { use } from './use';

declare namespace has {
  type Callback<T = any> = (model: T) => void | boolean | (() => void);
}

function has <T extends Model> (type: Model.Type<T>, one: true): T;
function has <T extends Model> (type: Model.Type<T>, required: boolean): T | undefined;
function has <T extends Model> (type: Model.Type<T>, arg?: has.Callback<T>): Set<T>;
  
function has <T extends Model> (
  type: Model.Type<T>,
  argument?: boolean | has.Callback<T>){

  return use<T>((key, subject, state) => {
    if(typeof argument == "boolean"){
      type.context(subject, context => {
        context.put(type, (model) => {
          // Might like to throw if already exists, but race-condition
          // can prevent us from knowing if previous model is removed.
          subject.set(key as any, model);
  
          const remove = () => {
            if(state[key] === model)
              delete state[key];
          }
          model.get(null, remove);
  
          return remove;
        })
      });

      return { get: argument }
    }

    const children = new Set<T>();

    type.context(subject, context => {
      context.put(type, (model) => {
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
      })
    });

    return {
      value: children
    }
  })
}

export { has }