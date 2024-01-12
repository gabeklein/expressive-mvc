import { fetch, Model, STATE, update } from '../model';
import { watch } from '../control';

const INSTRUCT = new Map<symbol, Model.Instruction>();

function use<T = any>(instruction: Model.Instruction): T;

function use <T extends Model> (Type: Model.Type<T>, required: true): T;
function use <T extends Model> (Type: Model.Type<T>, required: boolean): T | undefined;

function use <T extends Model> (Type: Model.Type<T>, ready?: (i: T) => void): T;

function use(
  arg1: Model.Type | Model.Instruction,
  arg2?: ((i: Model) => void) | boolean){

  const token = Symbol("instruction");

  INSTRUCT.set(token, Model.is(arg1)
    ? instruction.bind(null, arg1, arg2)
    : arg1
  );

  return token;
}

function instruction(
  type: Model.Type,
  argument: ((i: Model) => void) | boolean | undefined,
  key: string,
  subject: Model,
  state: Model.State<any>){

  const desc = { get, set };

  function set(next: Model | undefined){
    if(next ? !(next instanceof type) : argument !== !!next)
      throw new Error(`${subject}.${key} expected Model of type ${type} but got ${next && next.constructor}.`)

    update(subject, key, next);

    if(next && typeof argument == "function")
      argument(next);

    return false;
  }

  function get(){
    const suspend = typeof argument == "boolean" && argument;
    const value = fetch(subject, key, suspend);

    return value;
  }

  return desc;
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