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
    const expect = (callback: (model: T) => (() => void) | void) =>
      type.context(subject, ctx => ctx.put(type, callback));

    if(typeof argument == "boolean"){
      expect((model) => {
        // Might like to throw if already exists, but race-condition
        // can prevent us from knowing if previous model is removed.
        subject.set(key, model);

        const remove = () => {
          if(state[key] === model)
            delete state[key];
        }
        model.get(null, remove);

        return remove;
      })

      return { get: argument }
    }

    const value = new Set<T>();

    expect((model) => {
      if(value.has(model))
        return;

      const remove = typeof argument == "function"
        ? argument(model)
        : undefined;

      if(remove === false)
        return;

      value.add(model);
      subject.set(key);
      
      const done = () => {
        drop();

        if(typeof remove == "function")
          remove();

        value.delete(model);
        subject.set(key);
      }

      const drop = model.get(null, done);

      return done;
    })

    return { value }
  })
}

export { has }