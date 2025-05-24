import { watch } from '../control';
import { fetch, mayAdopt, Model, PARENT, STATE, update } from '../model';

const INSTRUCT = new Map<symbol, Model.Instruction>();

function use <T> (instruction: Model.Instruction<T>): T extends void ? unknown : T;

function use <T extends Model> (Type: Model.Init<T>, required: false): T | undefined;

function use <T extends Model> (Type: Model.Init<T>, ready?: (i: T) => void): T;

function use(
  arg1: Model.Init | Model.Instruction,
  arg2?: ((i: Model) => void) | boolean){

  const token = Symbol("instruction");

  if(Model.is(arg1))
    arg1 = child(arg1, arg2);

  INSTRUCT.set(token, arg1);
  return token;
}

function child(
  type: Model.Init<Model>,
  arg2?: ((i: Model) => void) | boolean
): Model.Instruction<any, any> {
  return (key, subject) => {
    function set(next: Model | undefined){
      if(next ? !(next instanceof type) : arg2 !== false)
        throw new Error(`${subject}.${key} expected Model of type ${type} but got ${next && next.constructor}.`);

      update(subject, key, next);

      if(next && typeof arg2 == "function")
        arg2(next);

      return false;
    }

    const value = new type();

    set(value);
    PARENT.set(value, subject);

    return { set };
  }
}

Model.on((_, model) => {
  const state = STATE.get(model)!;

  for(const key in model){
    const { value } = Object.getOwnPropertyDescriptor(model, key)!;
    const instruction = INSTRUCT.get(value);

    if(!instruction){
      mayAdopt(model, value);
      continue;
    }

    INSTRUCT.delete(value);
    delete (model as any)[key];

    const output = instruction.call(model, key, model, state);

    if(!output)
      continue;

    const desc = typeof output == "object" ? output : { get: output };

    if("value" in desc)
      state[key] = desc.value;

    Object.defineProperty(model, key, {
      enumerable: desc.enumerable !== false,
      get(this: Model){
        return watch(this, key, 
          typeof desc.get == "function"
            ? desc.get(this)
            : fetch(model, key, desc.get)
        );
      },
      set(next){
        if(desc.set === false)
          throw new Error(`${model}.${key} is read-only.`);

        update(model, key, next, desc.set);
      }
    })
  }

  return null;
});

export { use }