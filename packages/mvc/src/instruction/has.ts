import { Context } from '../context';
import { Model } from '../model';
import { use } from './use';

const APPLY = new WeakMap<Model, ((model: Model) => (() => void) | void)[]>();

declare namespace has {
  type Callback<T = any> = (model: T, recipient: Model) => void | boolean | (() => void);
}

function has <T extends Model> (type: Model.Type<T>, callback?: has.Callback<T>): readonly T[];
function has (callback?: has.Callback): Model | undefined;
  
function has <T extends Model> (
  arg1?: Model.Type<T> | has.Callback<Model>,
  arg2?: has.Callback<T>){

  return use<T>((key, subject) => {
    const register = new Set<Model>();
    const update = () => {
      subject.set(key, Object.freeze(Array.from(register)));
    }

    if(!Model.is(arg1))
      APPLY.set(subject, (APPLY.get(subject) || []).concat(recipient => {
        if(register.has(recipient))
          return;

        let remove: (() => void) | boolean | void;

        if(arg1){
          remove = arg1(recipient, subject);
  
          if(remove === false)
            return;
        }

        register.add(recipient);
        update();

        return () => {
          register.delete(recipient);
          update();

          if(typeof remove == "function")
            remove();
        }
      }));
    else
      Context.get(subject, ctx => ctx.put(arg1, got => {
        let remove: (() => void) | void | undefined;

        if(register.has(got))
          return;

        if(typeof arg2 == "function"){
          const done = arg2(got, subject);

          if(done === false)
            return;
          
          remove = () => {
            if(typeof done == "function")
              done();
          }
        }
        
        let disconnect: (() => void) | undefined;
        
        const callbacks = APPLY.get(got);

        if(callbacks){
          const after = callbacks.map(callback => callback(subject));
          disconnect = () => after.forEach(cb => cb && cb());
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
      }));

    return { value: [] };
  })
}

export { has }