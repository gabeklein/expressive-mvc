import { watch } from '../control';
import { fetch, Model, STATE, update } from '../model';

const INSTRUCT = new Map<symbol, Model.Instruction>();

function add<T = any>(instruction: Model.Instruction){
  const token = Symbol("instruction");
  INSTRUCT.set(token, instruction);
  return token as unknown as T;
}

function instructions(key: unknown, subject: Model){
  if(key !== true)
    return;

  const state = STATE.get(subject)!;
  const log = String(subject).startsWith("Output");

  if(log)
    console.log(`Do instructions for ${subject}`);

  for(const key in subject){
    const { value } = Object.getOwnPropertyDescriptor(subject, key)!;
    const instruction = INSTRUCT.get(value);

    if(log)
      console.log(`Do instruction for ${subject}.${key}`);

    if(!instruction)
      continue;

    INSTRUCT.delete(value);
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
  }

  if(log)
    console.log(`Did instructions for ${subject}`);

  return null;
}

Model.on(instructions)

export { add }