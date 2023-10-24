import { watch } from '../control';
import { fetch, Model, STATE, update } from '../model';

const INSTRUCT = new Map<symbol, Model.Instruction>();

function add<T = any>(instruction: Model.Instruction){
  const token = Symbol("instruction");
  INSTRUCT.set(token, instruction);
  return token as unknown as T;
}

function instructions(_: unknown, subject: Model){
  const state = STATE.get(subject)!;
  const log = String(subject).startsWith("Output");
  const properties = Object.entries(Object.getOwnPropertyDescriptors(subject));

  if(log){
    console.log(`Do instructions for ${subject}`);
  }

  properties.forEach(([key, { value }]) => {
    const instruction = INSTRUCT.get(value);

    if(!instruction){
      if(log)
        console.log(`${subject}.${key} not instruction`);

      return;
    }

    if(log)
      console.log(`${subject}.${key} instruction`);

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
  })

  if(log)
    console.log(`Did instructions for ${subject}`);

  return null;
}

Model.on(instructions)

export { add }