import { fetch, Model, STATE, PARENT, update } from '../model';
import { watch } from '../control';

const INSTRUCT = new Map<symbol, Model.Instruction>();

function use<T = any>(instruction: Model.Instruction<T>): T;

function use <T extends Model> (Type: Model.Init<T>, required: false): T | undefined;

function use <T extends Model> (Type: Model.Init<T>, ready?: (i: T) => void): T;

function use(
  arg1: Model.Init | Model.Instruction,
  arg2?: ((i: Model) => void) | boolean){

  const token = Symbol("instruction");

  if(Model.is(arg1)){
    const type = arg1;

    arg1 = (key, subject) => {
      const value = new type();
      const desc: Model.Descriptor = { set };

      set(value);
      PARENT.set(value, subject);

      function set(next: Model | undefined){
        if(next ? !(next instanceof type) : arg2 !== false)
          throw new Error(`${subject}.${key} expected Model of type ${type} but got ${next && next.constructor}.`)
  
        update(subject, key, next);
  
        if(next && typeof arg2 == "function")
          arg2(next);
  
        return false;
      }
  
      return desc;
    }
  }

  INSTRUCT.set(token, arg1);
  return token;
}

Model.on((_, subject) => {
  const state = STATE.get(subject)!;
  const props = Object.getOwnPropertyDescriptors(subject);

  for(const key in props){
    const { value } = props[key];
    const instruction = INSTRUCT.get(value);

    if(!instruction){
      if(value instanceof Model && key !== "is")
        update(subject, key, value);

      continue;
    }

    INSTRUCT.delete(value);
    delete (subject as any)[key];

    const output = instruction.call(subject, key, subject, state);

    if(!output)
      continue;

    const desc = typeof output == "object" ? output : { get: output };

    if("value" in desc)
      state[key] = desc.value;

    Object.defineProperty(subject, key, {
      enumerable: desc.enumerable !== false,
      get(this: Model){
        return watch(this, key, 
          typeof desc.get == "function"
            ? desc.get(this)
            : fetch(subject, key, desc.get)
        );
      },
      set(next){
        if(desc.set === false)
          throw new Error(`${subject}.${key} is read-only.`);

        update(subject, key, next, desc.set);
      }
    })
  }

  return null;
});

export { use }