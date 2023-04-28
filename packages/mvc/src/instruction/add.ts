import { Control } from '../control';

const PENDING = new Map<symbol, Control.Instruction<any>>();

/**
 * Run instruction as model sets itself up.
 * This will specialize the behavior of a given property.
 */
export function add<T = any>(
  instruction: Control.Instruction<any>,
  label?: string){

  const name = label || instruction.name || "pending";
  const placeholder = Symbol(name + " instruction");

  PENDING.set(placeholder, instruction);

  return placeholder as unknown as T;
}

export function setInstruction(
  onto: Control,
  key: string,
  from: any
){
  const instruction = PENDING.get(from);

  if(!instruction)
    return;

  delete onto.subject[key];
  PENDING.delete(from);

  let output = instruction.call(onto, key, onto);

  if(output){
    if(typeof output == "function")
      output = { get: output };

    onto.watch(key, output);
  }

  return true;
}