import { Context } from '../context';
import { Model } from '../model';
import { use } from './use';

const APPLY = new WeakMap<Model, ((model: Model) => (() => void) | void)[]>();

declare namespace has {
  type Callback<T = any> = (model: T) => void | boolean | (() => void);
}

function has <T extends Model> (type: Model.Type<T>, one: true): T;
function has <T extends Model> (type: Model.Type<T>, required: boolean): T | undefined;
function has <T extends Model> (type: Model.Type<T>, callback?: has.Callback<T>): Set<T>;

function has (callback?: has.Callback): Model | undefined;
  
function has <T extends Model> (
  arg1?: Model.Type<T> | has.Callback<Model>,
  arg2?: boolean | has.Callback<T>){

  return use<T>((key, subject, state) => {
    const value = new Set<Model>();

    let output: Model.Descriptor = { value };
    let callback: (model: T) => void | (() => void);

    if(!Model.is(arg1)){
      APPLY.set(subject, (APPLY.get(subject) || []).concat(recipient => {
        if(state[key] === recipient)
          return;

        let remove: (() => void) | boolean | void;

        if(arg1){
          remove = arg1(recipient);
  
          if(remove === false)
            return;
        }

        subject.set(key, recipient);

        return () => {
          subject.set(key, undefined);

          if(typeof remove == "function")
            remove();
        }
      }));

      return { get: false };
    }

    if(typeof arg2 == "boolean"){
      output = { get: arg2 };
      callback = (model) => {
        subject.set(key, model);

        return () => {
          if(state[key] === model)
            delete state[key];
        }
      }
    }
    else {
      callback = (model) => {
        if(value.has(model))
          return;

        const remove = arg2 && arg2(model);

        if(remove === false)
          return;

        value.add(model);
        subject.set(key);
        
        return () => {
          if(typeof remove == "function")
            remove();

          value.delete(model);
          subject.set(key);
        }
      }
    }

    Context.get(subject, ctx => ctx.put(arg1, got => {
      const remove = callback(got);
      let disconnect: (() => void) | undefined;

      if(!remove)
        return;
      
      const callbacks = APPLY.get(got);

      if(callbacks){
        const after = callbacks.map(callback => callback(subject));
        disconnect = () => after.forEach(cb => cb && cb());
      }

      const done = () => {
        reset();

        if(disconnect)
          disconnect();

        if(typeof remove == "function")
          remove();
      }

      const reset = got.get(null, done);
      
      return done;
    }));

    return output;
  })
}

export { has }