import { Controller, PENDING } from '../controller';
import { CONTROL, LOCAL, Stateful } from '../model';
import { Subscriber } from '../subscriber';
import { suspend } from '../suspense';
import { defineProperty } from '../util';
import { Instruction } from './types';

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
    const { proxy, state, subject } = this;

    PENDING.delete(placeholder);
    delete subject[key];

    let output = fn.call(this, key, this);

    if(typeof output == "boolean")
      return output;

    if(typeof output == "function")
      output = { get: output };

    if(typeof output != "object")
      return;
      
    if("explicit" in output && output.explicit){
      defineProperty(subject, key, output);
      return false;
    }

    if("recursive" in output && output.recursive)
      output = {
        ...output,
        get: recursive(this, key)
      }

    const desc = output as Instruction.Descriptor<any>;

    if("value" in desc)
      state[key] = desc.value as any;

    let onGet = desc.get;
    let onSet = desc.set;
    let enumerable = desc.enumerable;
    let suspense = desc.suspense;
    let set = onSet === false
      ? undefined
      : this.ref(key, onSet);

    const get = (local?: Subscriber) => {
      if(!(key in state) && suspense)
        throw suspend(this, key);

      const value = state[key];

      if(onGet)
        return local
          ? onGet(value, local)
          : onGet(value)

      return value;
    }

    defineProperty(subject, key, {
      enumerable, set, get
    });

    defineProperty(proxy, key, {
      enumerable, set,
      get(){
        const local = this[LOCAL];

        if(local && !local.watch[key])
          local.watch[key] = true;

        return get(local);
      }
    });
  }

  PENDING.set(placeholder, setup);

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