import {
  fetch,
  Model,
  PARENT,
  STATE,
  uid,
  update,
  watch,
  Instruction
} from '../model';

const INSTRUCTION = new Map<symbol, Instruction>();

function use<T>(instruction: Instruction<T>): T extends void ? unknown : T;

function use<T extends Model>(
  Type: Model.Init<T>,
  required: false
): T | undefined;

function use<T extends Model>(Type: Model.Init<T>, ready?: (i: T) => void): T;

function use(
  arg1: Model.Init | Instruction,
  arg2?: ((i: Model) => void) | boolean
) {
  if (Model.is(arg1)) arg1 = childInstruction(arg1, arg2);

  const token = Symbol('instruction-' + uid());
  INSTRUCTION.set(token, arg1);
  return token;
}

function childInstruction(
  type: Model.Init<Model>,
  arg2?: ((i: Model) => void) | boolean
): Instruction<any, any> {
  return (key, subject) => {
    function set(next: Model | undefined) {
      if (next ? !(next instanceof type) : arg2 !== false)
        throw new Error(
          `${subject}.${key} expected Model of type ${type} but got ${
            next && next.constructor
          }.`
        );

      update(subject, key, next);

      if (next && typeof arg2 == 'function') arg2(next);

      return false;
    }

    const value = new type();

    set(value);
    PARENT.set(value, subject);
    value.set();

    return { set };
  };
}

function init(this: Model) {
  const state = STATE.get(this)!;

  for (const key in this) {
    const { value } = Object.getOwnPropertyDescriptor(this, key)!;
    const instruction = INSTRUCTION.get(value);

    if (!instruction) continue;

    INSTRUCTION.delete(value);
    delete (this as any)[key];

    const output = instruction.call(this, key, this, state);

    if (!output) continue;

    const desc = typeof output == 'object' ? output : { get: output };

    if ('value' in desc) state[key] = desc.value;

    const model = this;

    Object.defineProperty(model, key, {
      enumerable: desc.enumerable !== false,
      get(this: Model) {
        return watch(
          this,
          key,
          typeof desc.get == 'function'
            ? desc.get(this)
            : fetch(model, key, desc.get)
        );
      },
      set(next) {
        if (desc.set === false)
          throw new Error(`${model}.${key} is read-only.`);

        update(model, key, next, desc.set);
      }
    });
  }

  return null;
}

Model.on(init);

export { use };
