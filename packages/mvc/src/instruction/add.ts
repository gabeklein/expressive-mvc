import { watch } from '../control';
import { fetch, INSTRUCT, Model, update } from '../model';

declare const VALUE: unique symbol;

declare namespace add {
  /**
   * Property initializer, will run upon instance creation.
   * Optional returned callback will run when once upon first access.
   */
  type Special<T = any, M extends Model = any> =
    (this: M, key: Model.Key<M>, thisArg: M, state: Model.Export<M>) =>
      Descriptor<T> | Getter<T> | void;

  type Getter<T> = (source: Model) => T;

  type Setter<T> = (value: T, previous: T) => boolean | void | (() => T);

  type Descriptor<T = any> = {
    get?: Getter<T> | boolean;
    set?: Setter<T> | false;
    enumerable?: boolean;
    value?: T;
  }
}

function add<T = any, S = T>(instruction: add.Special){
  const placeholder = Symbol("instruction");

  INSTRUCT.set(placeholder, (subject, key, state) => {
    INSTRUCT.delete(placeholder);
    delete (subject as any)[key];

    const output = instruction.call(subject, key, subject, state);
  
    if(!output)
      return;

    const desc = typeof output == "object" ? output : { get: output };
    const { enumerable = true } = desc;

    if("value" in desc)
      state[key] = desc.value;

    Object.defineProperty(subject, key, {
      enumerable,
      set(next){
        let { set } = desc;

        if(set === false)
          throw new Error(`${subject}.${key} is read-only.`);

        if(typeof set == "function"){
          const result = set.call(subject, next, state[key]);

          if(result === false)
            return;

          if(typeof result == "function")
            next = result();

          set = false;
        }

        update(subject, key, next, !!set);
      },
      get(this: Model){
        return watch(this, key, 
          typeof desc.get == "function"
            ? desc.get(this)
            : fetch(subject, key, desc.get)
        );
      }
    })
  });

  return placeholder as unknown as S extends T ? T : T & { [VALUE]: S };
}

export { add }