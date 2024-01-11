import { Context } from '../context';
import { Model } from '../model';
import { use } from './use';

const APPLY = new WeakMap<Model, has.WillApply>();

declare namespace has {
  type WillApply<T = any> = (model: T, recipient: Model) => void | null | boolean | (() => void);
  type WillBeApplied<T = any> = (recipient: Model, model: T) => void | null | boolean | (() => void);
}

function has <T extends Model> (type: Model.Type<T>, callback?: has.WillApply<T>): readonly T[];
function has (callback?: has.WillBeApplied): readonly Model[];
  
function has <T extends Model> (
  arg1?: Model.Type<T> | has.WillBeApplied<T>,
  arg2?: has.WillApply<T>){

  return use<T>((key, subject) => {
    const register = new Set<Model>();
    const update = () => {
      subject.set(key, Object.freeze(Array.from(register)));
    }

    if(!Model.is(arg1)){
      if(APPLY.has(subject))
        throw new Error(`'has' callback can only be used once per model.`);

      APPLY.set(subject, recipient => {
        if(register.has(recipient))
          return;

        let remove: (() => void) | undefined;

        if(arg1){
          const output = arg1(recipient, subject);
  
          if(output === false)
            return false;

          if(typeof output == "function")
            remove = output;
        }

        register.add(recipient);
        update();

        return () => {
          register.delete(recipient);
          update();

          if(remove)
            remove();
        }
      });
    }
    else
      Context.get(subject, ctx => {
        ctx.request(arg1, got => {
          let remove: (() => void) | void | undefined;
          let disconnect: (() => void) | undefined;
  
          if(register.has(got))
            return;
          
          const callback = APPLY.get(got);
  
          if(callback){
            const after = callback(subject, got);
  
            if(after === false)
              return;
            else if(typeof after == "function")
              disconnect = after;
          }
  
          if(typeof arg2 == "function"){
            const done = arg2(got, subject);
  
            if(done === false)
              return;
            
            remove = () => {
              if(typeof done == "function")
                done();
            }
          }
  
          register.add(got);
          update();
  
          const done = () => {
            reset();
  
            register.delete(got);
            update();
  
            if(disconnect)
              disconnect();
  
            if(typeof remove == "function")
              remove();
          }
  
          const reset = got.get(null, done);
          
          return done;
        })
      });

    // subject.get(null, () => register.clear());

    return { value: [] };
  })
}

export { has }