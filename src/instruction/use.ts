import { Control } from '../control';
import { issues } from '../issues';
import { Model } from '../model';
import { assign } from '../object';
import { Subscriber } from '../subscriber';
import { mayRetry } from '../suspense';
import { add, getRecursive } from './add';
import { keyed, Managed } from './use.keyed';

export const Parent = new WeakMap<{}, {}>();

export const Oops = issues({
  BadArgument: (type) =>
    `Instruction \`use\` cannot accept argument type of ${type}.`,

  NotReady: (model, key) =>
    `Value ${model}.${key} value is not yet available.`
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
function use <T extends Model> (from: () => T, required: false): T | undefined;
function use <T extends Model> (from: () => T, required: boolean): T;

 /**
  * Create a new child instance of model.
  */
function use <T extends Model> (Type: Model.Type<T>, callback?: (i: T) => void): T;

 /**
  * Create a managed child from factory function.
  */
function use <T extends {}> (from: () => Promise<T>, required: false): T | undefined;
function use <T extends {}> (from: () => Promise<T>, required: boolean): T;
function use <T extends {}> (from: () => Promise<T>, callback?: (i: T) => void): T;
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

function use(
  input?: any,
  argument?: boolean | ((i: {} | undefined) => void)){

  return add(
    function use(key){
      const { state, subject } = this;
      const required = argument !== false;

      let pending: Promise<any> | undefined;
      let error: any;
      let get: (local: Subscriber | undefined) => any =
        (_local: Subscriber | undefined) => state.get(key);

      if(typeof input === "function"){
        if("prototype" in input &&
        input === input.prototype.constructor)
          input = new input();
      }

      else if(input && typeof input !== "object")
        throw Oops.BadArgument(typeof input);

      if(input instanceof Map || input instanceof Set)
        return keyed(this, key, input);

      const onUpdate = (next: {} | undefined) => {
        state.set(key, next);

        if(next){
          get = getRecursive(key, this);
          Parent.set(next, subject);
          Control.for(next);
        }

        if(typeof argument == "function")
          argument(next);

        return true;
      }

      const suspend = () => {
        if(required === false)
          return;

        const issue =
          Oops.NotReady(subject, key);

        assign(pending!, {
          message: issue.message,
          stack: issue.stack
        });

        throw pending;
      }

      const initialize = () => {
        const output = typeof input == "function" ?
          mayRetry(() => input.call(subject, subject)) :
          input;

        if(output instanceof Promise){
          pending = output
            .catch(err => error = err)
            .then(val => {
              onUpdate(val);
              return val;
            })
            .finally(() => {
              pending = undefined;
              this.update(key);
            })

          return;
        }

        onUpdate(output);
      }

      if(input !== undefined && required)
        initialize();

      return {
        set: onUpdate,
        get(local){
          if(pending)
            return suspend();
  
          if(error)
            throw error;

          if(!state.has(key))
            initialize();
  
          if(pending)
            return suspend();
  
          return get(local);
        }
      };
    }
  )
}

export { use }