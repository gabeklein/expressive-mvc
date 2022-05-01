import { control } from '../controller';
import { issues } from '../issues';
import { Model, Stateful } from '../model';
import { Class, InstanceOf } from '../types';
import { child } from './child';
import { Parent } from './parent';

export const Oops = issues({
  BadArgument: (type) =>
    `Instruction \`use\` cannot accept argument type of ${type}.`,
})

/**
 * Create a placeholder for specified Model type.
 */
function use <T extends Model> (): T | undefined;

 /**
  * Create a new child instance of model.
  */
function use <T extends Class> (Type: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T>;
 
 /**
  * Create a managed child from factory function.
  */
function use <T extends {}> (from: () => T, callback?: (i: T) => void): T;
 
 /**
  * Create child-instance relationship with provided model.
  *
  * Note: If `peer` is not already initialized before parent is
  * (created with `new` as opposed to create method), that model will
  * attach this via `parent()` instruction. It will not, however, if
  * already active.
  */
function use <T extends {}> (peer: T, callback?: (i: T) => void): T;

function use<T extends typeof Model>(
  input?: T | (() => InstanceOf<T>),
  argument?: (i: InstanceOf<T> | undefined) => void){

  return child(
    function use(key){
      const { subject } = this;
  
      const onUpdate = (next: Stateful | undefined) => {
        this.state[key] = next;

        if(next){
          Parent.set(next, subject);
          control(next);
        }
  
        if(typeof argument == "function")
          argument(next as InstanceOf<T>);

        return true;
      }
  
      if(input){
        const value =
          Model.isTypeof(input)
            ? new input() :
          typeof input === "object"
            ? input :
          typeof input === "function"
            ? input()
            : null;

        if(value === null)
          throw Oops.BadArgument(typeof input);

        if(value)
          onUpdate(value);
      }
  
      return onUpdate;
    }
  )
}

export { use }