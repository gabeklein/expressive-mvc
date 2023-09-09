import { watch } from '../control';
import { fetch, INSTRUCT, Model, update } from '../model';

export function add<T = any, M extends Model = any>(instruction: Model.Instruction){
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

    return {
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
      get(this: M){
        return watch(this, key, 
          typeof desc.get == "function"
            ? desc.get(this)
            : fetch(subject, key, desc.get)
        );
      }
    }
  });

  return placeholder as unknown as T;
}