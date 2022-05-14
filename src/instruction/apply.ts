import { Controller } from '../controller';
import { CONTROL, Stateful } from '../model';
import { Subscriber } from '../subscriber';
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

    if(typeof output == "function")
      return { get: output };

    if(typeof output !== "object")
      return output || undefined;

    if("explicit" in output && output.explicit){
      defineProperty(this.subject, key, output);
      return false;
    }

    if("recursive" in output)
      output = {
        ...output,
        get: recursive(this, key)
      }

    return output;
  }

  Pending.set(placeholder, setup);

  return placeholder as unknown as T;
}

function recursive(source: Controller, key: string){
  const context = new WeakMap<Subscriber, any>();

  const subscribe = (parent: Subscriber) => {
    let child: Subscriber | undefined;

    const init = () => {
      if(child){
        child.release();
        parent.dependant.delete(child);
        context.set(parent, undefined);
        child = undefined;
      }

      const value = source.state[key];

      if(value && CONTROL in value){
        child = new Subscriber(value as Stateful, parent.onUpdate);
  
        if(parent.active)
          child.commit();
  
        parent.dependant.add(child);
        context.set(parent, child.proxy);
      }
    }

    init();
    parent.watch[key] = init;
  }

  return (value: any, local: Subscriber | undefined) => {
    if(!local)
      return value;

    if(!context.has(local))
      subscribe(local);

    return context.get(local);
  }

}

export { apply }