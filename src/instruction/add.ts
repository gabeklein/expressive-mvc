import { Control, PENDING } from '../control';
import { defineProperty } from '../helper/object';
import { Subscriber, subscriber } from '../subscriber';
import { suspend } from '../suspense';

/**
 * Property initializer, will run upon instance creation.
 * Optional returned callback will run when once upon first access.
 */
type Instruction<T> = (this: Control, key: string, thisArg: Control) =>
  | Instruction.Getter<T> 
  | Instruction.ExplicitDescriptor
  | Instruction.Descriptor<T>
  | boolean
  | void;

declare namespace Instruction {
  type Getter<T> = (within?: Subscriber) => T;
  type Setter<T> = (value: T) => boolean | void;

  type Runner<T> = (this: Control, key: string, on: Control) =>
    Instruction.Descriptor<T> | boolean | undefined;

  interface Descriptor<T> {
    configurable?: boolean;
    enumerable?: boolean;
    value?: T;
    writable?: boolean;
    get?: Getter<T>;
    set?: Setter<T> | false;
    suspend?: boolean;
    destroy?: () => void;
  }

  interface ExplicitDescriptor extends PropertyDescriptor {
    explicit: true;
  }
}

/**
 * Run instruction as controller sets itself up.
 * This will specialize the behavior of a given property.
 */
function add<T = any>(
  instruction: Instruction<any>,
  label?: string){

  const name = label || instruction.name || "pending";
  const placeholder = Symbol(`${name} instruction`);

  function setup(this: Control, key: string){
    const { subject, state } = this;

    let output = instruction.call(this, key, this);

    if(typeof output == "function")
      output = { get: output };

    if(typeof output != "object")
      return;

    if("explicit" in output && output.explicit){
      defineProperty(subject, key, output);
      return false;
    }

    let {
      get: onGet,
      set: onSet,
      suspend: shouldSuspend
    } = output as Instruction.Descriptor<any>;

    if("value" in output)
      state.set(key, output.value);

    if("destroy" in output){
      const { destroy } = output;

      if(destroy)
        this.addListener((key) => {
          if(key == null)
            destroy();
        })
    }

    const control = this;

    defineProperty(subject, key, {
      enumerable: output.enumerable,

      set: onSet === false
        ? undefined
        : this.ref(key, onSet),

      get(this: any){
        if(!state.has(key) && shouldSuspend)
          throw suspend(control, key);
  
        const local = subscriber(this);
        const required = local && local.suspend;
  
        if(local)
          local.add(key);
  
        try {
          const value = onGet
            ? onGet(local)
            : state.get(key);
          
          if(value === undefined && required === true)
            throw suspend(control, key);
            
          return value;
        }
        catch(err){
          if(err instanceof Promise && required === false)
            return;

          throw err;
        }
      }
    });
  }

  PENDING.set(placeholder, setup);

  return placeholder as unknown as T;
}

export { add, Instruction }