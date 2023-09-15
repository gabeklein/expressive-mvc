import { watch } from '../control';
import { fetch, Model, STATE, update } from '../model';

type InstructionRunner<T extends Model = any> =
  (on: T, key: string, state: Model.Export<T>) => PropertyDescriptor | void;

const INSTRUCT = new Map<symbol, InstructionRunner>();

function add<T = any>(instruction: Model.Instruction){
  const placeholder = Symbol("instruction");

  INSTRUCT.set(placeholder, (subject, key, state) => {
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

  return placeholder as unknown as T;
}

Model.on(function(){
  const state = STATE.get(this)!;

  for(const key in this){
    const { value } = Object.getOwnPropertyDescriptor(this, key)!;
    const instruction = INSTRUCT.get(value);

    if(!instruction)
      continue;

    INSTRUCT.delete(value);
    delete (this as any)[key];
    instruction(this, key, state);
  }

  return null;
})

export { add }