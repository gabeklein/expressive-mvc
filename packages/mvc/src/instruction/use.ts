import { fetch, Model, STATE, update } from '../model';
import { watch } from '../control';

const INSTRUCT = new Map<symbol, Model.Instruction>();

function use<T = any>(instruction: Model.Instruction): T;

function use <T extends Model> (Type: Model.Type<T>, required: false): T | undefined;

function use <T extends Model> (Type: Model.Type<T>, ready?: (i: T) => void): T;

function use(
  model: Model.Type | Model.Instruction,
  argument?: ((i: Model) => void) | boolean){

  const token = Symbol("instruction");

  if(Model.is(model)){
    const type = model;
    const value = new model();

    model = (key, subject) => {
      function set(next: Model | undefined){
        if(next ? !(next instanceof type) : argument !== false)
          throw new Error(`${subject}.${key} expected Model of type ${type} but got ${next && next.constructor}.`)
  
        update(subject, key, next);
  
        if(next && typeof argument == "function")
          argument(next);
  
        return false;
      }
  
      set(value);
  
      return { set, value };
    }
  }

  INSTRUCT.set(token, model);
  return token;
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
      get(this: Model){
        return watch(this, key, 
          typeof desc.get == "function"
            ? desc.get(this)
            : fetch(subject, key, desc.get)
        );
      },
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
      }
    })
  }

  return null;
})

export { use }