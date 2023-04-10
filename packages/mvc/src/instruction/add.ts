import { Control, PENDING } from '../control';

/**
 * Run instruction as controller sets itself up.
 * This will specialize the behavior of a given property.
 */
function add<T = any>(
  instruction: Control.Instruction<any>,
  label?: string){

  const name = label || instruction.name || "pending";
  const placeholder = Symbol(name + " instruction");

  PENDING.set(placeholder, instruction);

  return placeholder as unknown as T;
}

export { add }