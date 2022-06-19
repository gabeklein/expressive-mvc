import { Controller, PENDING } from '../controller';
import { CONTROL, LOCAL, Stateful } from '../model';
import { Subscriber } from '../subscriber';
import { suspend } from '../suspense';
import { defineProperty } from '../util';

/**
 * Property initializer, will run upon instance creation.
 * Optional returned callback will run when once upon first access.
 */
type Instruction<T> = (this: Controller, key: string, thisArg: Controller) =>
  | Instruction.Getter<T> 
  | Instruction.ExplicitDescriptor
  | Instruction.Descriptor<T>
  | Instruction.RecursiveDescriptor<T>
  | boolean
  | void;

declare namespace Instruction {
  type Getter<T> = (within?: Subscriber) => T;
  type Setter<T> = (value: T) => boolean | void;

  type Runner<T> = (this: Controller, key: string, on: Controller) =>
    Instruction.Descriptor<T> | boolean | undefined;

  interface Descriptor<T> {
    configurable?: boolean;
    enumerable?: boolean;
    value?: T;
    writable?: boolean;
    get?: Getter<T>;
    set?: Setter<T> | false;
    suspense?: boolean;
  }

  interface ExplicitDescriptor extends PropertyDescriptor {
    explicit: true;
  }

  interface RecursiveDescriptor<T> {
    recursive: true;
    enumerable?: boolean;
    value?: T;
    set?: Setter<T> | false;
    suspense?: boolean;
  }
}

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
    const { proxy, subject } = this;
    const control = this;

    PENDING.delete(placeholder);
    delete subject[key];

    let output = fn.call(this, key, this);

    if(typeof output == "function")
      output = { get: output };

    if(typeof output != "object")
      return;

    if("explicit" in output && output.explicit){
      defineProperty(subject, key, output);
      return false;
    }

    if("recursive" in output && output.recursive){
      const context = new WeakMap<Subscriber, T | undefined>();

      output = {
        ...output,
        get: (local: Subscriber | undefined) => {
          if(!local)
            return this.get(key);
      
          if(!context.has(local)){
            let child: Subscriber | undefined;
    
            const init = () => {
              if(child){
                child.release();
                local.dependant.delete(child);
                context.set(local, undefined);
                child = undefined;
              }
        
              const value = this.get(key);
        
              if(value && CONTROL in value){
                child = new Subscriber(value as Stateful, local.onUpdate);
        
                if(local.active)
                  child.commit();
        
                local.dependant.add(child);
                context.set(local, child.proxy);
              }
            }
        
            init();
            local.watch[key] = init;
          }
      
          return context.get(local);
        }
      }
    }

    const desc = output as Instruction.Descriptor<any>;

    if("value" in desc)
      this.set(key, desc.value);

    const {
      get: onGet,
      set: onSet,
      enumerable,
      suspense
    } = desc;

    let set = onSet === false
      ? undefined
      : this.ref(key, onSet);

    function get(this: Stateful){
      if(!control.has(key) && suspense)
        throw suspend(control, key);

      const local = this[LOCAL];

      if(local && !(key in local.watch))
        local.watch[key] = true;

      const value = control.get(key);

      if(!onGet)
        return value;

      return local
        ? onGet(local)
        : onGet()
    }

    for(const x of [subject, proxy])
      defineProperty(x, key, { enumerable, get, set });
  }

  PENDING.set(placeholder, setup);

  return placeholder as unknown as T;
}

export { apply, Instruction }