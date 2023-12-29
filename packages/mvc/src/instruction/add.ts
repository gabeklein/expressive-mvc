import { watch } from '../control';
import { fetch, Model, STATE, update } from '../model';

const INSTRUCT = new Map<symbol, Model.Instruction>();

function add<T = any>(instruction: Model.Instruction){
  const token = Symbol("instruction");
  INSTRUCT.set(token, instruction);
  return token as unknown as T;
}

Model.on((_, subject) => {
  const state = STATE.get(subject)!;
  const props = Object.getOwnPropertyDescriptors(subject);

  for(const key in props){
    const { value } = props[key];
    const instruction = INSTRUCT.get(value);

    if(!instruction)
      continue;

    INSTRUCT.delete(value);
    delete (subject as any)[key];

    const output = instruction.call(subject, key, subject, state);
  
    if(!output)
      continue;

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
  }

  return null;
})

export { add }