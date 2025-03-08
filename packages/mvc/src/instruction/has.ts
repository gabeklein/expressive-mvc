import { Context } from '../context';
import { Model, update } from '../model';
import { use } from './use';

const APPLY = new WeakMap<Model, (model: Model) => (() => void) | boolean | void>();

declare namespace has {
  type Callback<T = any> = (model: T, recipient: Model) => void | boolean | (() => void);
}

function has <T extends Model> (type: Model.Type<T>, callback?: has.Callback<T>): readonly T[];
function has (callback?: has.Callback): readonly Model[];
  
function has <T extends Model> (
  arg1?: Model.Type<T> | has.Callback<Model>,
  arg2?: has.Callback<T>){

  return use<T[]>((key, subject) => {
    const applied = new Set<Model>();
    const apply = () => {
      update(subject, key, Object.freeze(Array.from(applied)));
    }

    if(Model.is(arg1))
      Context.get(subject, context => {
        context.has(arg1, model => {
          let remove: (() => void) | void | undefined;
          let disconnect: (() => void) | undefined;
  
          if(applied.has(model))
            return;
          
          const callback = APPLY.get(model);
  
          if(callback){
            const after = callback(subject);
  
            if(after === false)
              return;
  
            if(typeof after == "function")
              disconnect = after;
          }
  
          if(typeof arg2 == "function"){
            const done = arg2(model, subject);
  
            if(done === false)
              return false;
            
            remove = () => {
              if(typeof done == "function")
                done();
            }
          }
  
          applied.add(model);
          apply();
  
          const done = () => { 
            ignore();
  
            applied.delete(model);
            apply();
  
            if(disconnect)
              disconnect();
  
            if(typeof remove == "function")
              remove();
          }
  
          const ignore = model.set(null, done);
          
          return done;
        })
      });
    else {
      if(APPLY.has(subject))
        throw new Error(`'has' callback can only be used once per model.`);

      APPLY.set(subject, recipient => {
        let remove: (() => void) | boolean | void;

        if(arg1){
          remove = arg1(recipient, subject);
  
          if(remove === false)
            return false;
        }

        applied.add(recipient);
        apply();

        return () => {
          applied.delete(recipient);
          apply();

          if(typeof remove == "function")
            remove();
        }
      });
    }

    return { value: [] };
  })
}

export { has }