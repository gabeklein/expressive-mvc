import { Controller } from '../controller';
import { defineProperty } from '../util';
import { Instruction } from './types';

export const Pending = new Map<symbol, Instruction.Runner<any>>();

/**
 * Run instruction as controller sets itself up.
 * This will specialize the behavior of a given property.
 */
function apply <T = any> (instruction: Instruction<T>, name?: string): T;

function apply<T = any>(
  fn: Instruction<any>, label?: string){

  const name = label || fn.name || "pending";
  const placeholder = Symbol(`${name} instruction`);

  function setup(this: Controller, key: string){
    let output = fn.call(this, key, this);

    if(!output)
      return;

    if("explicit" in output){
      defineProperty(this.subject, key, output);
      return;
    }

    if(typeof output == "function")
      return { get: output };
    else
      return output;
  }

  Pending.set(placeholder, setup);

  return placeholder as unknown as T;
}

export { apply }