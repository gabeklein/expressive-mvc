import { Control, INSTRUCT } from '../control';

/**
 * Run instruction as model sets itself up.
 * This will specialize the behavior of a given property.
 */
export function add<T = any>(
  instruction: Control.Instruction<any>,
  label?: string){

  const name = label || instruction.name || "pending";
  const placeholder = Symbol(name + " instruction");

  INSTRUCT.set(placeholder, (key, onto) => {
    delete onto.subject[key];
  
    let output = instruction.call(onto, key, onto);
  
    if(output){
      if(typeof output == "function")
        output = { get: output };
  
      onto.watch(key, output);
    }
  });

  return placeholder as unknown as T;
}