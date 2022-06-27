import { issues } from '../../issues';
import { Model } from '../../model';
import { ensure } from '../../stateful';
import { Class, InstanceOf } from '../../types';
import { apply } from '../apply';
import { Parent } from '../parent';

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
  input?: T | (() => InstanceOf<T>) | InstanceOf<T>,
  argument?: (i: InstanceOf<T> | undefined) => void){

  return apply(
    function use(key){
      const { state, subject } = this;

      if(typeof input === "function")
        input = Model.isTypeof(input)
          ? new input() as InstanceOf<T> : input();

      else if(input && typeof input !== "object")
        throw Oops.BadArgument(typeof input);

      function onUpdate(next: {} | undefined){
        state.set(key, next);

        if(next){
          Parent.set(next, subject);
          ensure(next);
        }

        if(typeof argument == "function")
          argument(next as InstanceOf<T>);

        return true;
      }

      if(input)
        onUpdate(input);

      return {
        set: onUpdate,
        recursive: true
      };
    }
  )
}

export { use }