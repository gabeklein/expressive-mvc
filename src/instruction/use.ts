import { ensure } from '../controller';
import { issues } from '../issues';
import { Model } from '../model';
import { Class, InstanceOf } from '../types';
import { apply } from './apply';
import { keyed, Managed } from './use.keyed';

export const Parent = new WeakMap<{}, {}>();

export const Oops = issues({
  BadArgument: (type) =>
    `Instruction \`use\` cannot accept argument type of ${type}.`,
})

function use <K = any> (initial: SetConstructor): Managed<Set<K>>;
function use <K = any, V = any> (initial: MapConstructor): Managed<Map<K, V>>;

function use (initial: Set<unknown>): Managed<Set<any>>;
function use (initial: Map<unknown, unknown>): Managed<Map<any, any>>;

function use (from: () => Set<unknown>): Managed<Set<any>>;
function use (from: () => Map<unknown, unknown>): Managed<Map<any, any>>;

function use <T extends Set<any> | Map<any, any>> (initial: T): Managed<T>;
function use <T extends Set<any> | Map<any, any>> (from: () => T): Managed<T>;

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

function use<T extends Class>(
  input?: any,
  argument?: (i: InstanceOf<T> | undefined) => void){

  return apply(
    function use(key): any {
      const { state, subject } = this;

      if(typeof input === "function")
        input = "prototype" in input ? new input() : input();

      else if(input && typeof input !== "object")
        throw Oops.BadArgument(typeof input);

      if(input instanceof Map || input instanceof Set)
        return keyed(this, key, input);

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