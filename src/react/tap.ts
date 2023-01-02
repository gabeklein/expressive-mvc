import { apply } from '../instruction/apply';
import { issues } from '../issues';
import { Model, Stateful } from '../model';
import { Class, InstanceOf } from '../types';
import { Lookup } from './context';
import { Global } from './global';
import { useLookup } from './useLocal';

export const Oops = issues({
  NotAllowed: (parent, child) =>
    `Global '${parent}' attempted to attach '${child}' but it is not also a singleton.`,

  AmbientRequired: (requested, requester, key) =>
    `Attempted to find an instance of ${requested} in context. It is required for [${requester}.${key}], but one could not be found.`
})

export type Peer = typeof Model | typeof Global;
export type ApplyPeer = (context: Lookup) => void;
export type PeerCallback<T extends Peer> = (instance: InstanceOf<T> | undefined) => void | boolean;

const PendingContext = new WeakMap<Stateful, ApplyPeer[]>();
const ContextWasUsed = new WeakMap<Model, boolean>();

/**
 * Find and attach most applicable instance of Model via context.
 * 
 * Host controller will search element-hierarchy relative to where it spawned.
 * 
 * @param Type - Type of model to find from context
 * @param callback -
 *  - Invoked after context is scanned, is passed result - either found or undefined.
 *  - If argument is inadequate, but required, your implemention should simply throw.
 *  - If inadequate and not required, conditionally return false.
 */
function tap <T extends Class> (Type: T, callback?: (instance?: InstanceOf<T>) => void | true): InstanceOf<T>;
function tap <T extends Class> (Type: T, callback?: (instance?: InstanceOf<T>) => void | boolean): InstanceOf<T> | undefined;

/**
 * Find and attach most applicable instance of Model via context.
 *
 * Expects a `<Provider>` of target controller to exist. 
 * Host controller will search element-hierarchy relative to where it spawned.
 *
 * @param Type - Type of controller to attach to property. 
 * @param required - Throw if instance of Type cannot be found.
 */
function tap <T extends Class> (Type: T, required: true): InstanceOf<T>;
function tap <T extends Class> (Type: T, required?: boolean): InstanceOf<T> | undefined;

function tap<T extends Peer>(
  type: T, argument?: boolean | PeerCallback<T>){

  return apply(
    function tap(key){
      if("set" in type)
        return {
          recursive: true,
          value: type.get()
        }

      const { subject } = this;

      if("set" in subject.constructor)
        throw Oops.NotAllowed(subject, type.name);

      getPending(subject).push(context => {
        let instance = context.get(type);

        if(typeof argument == "function"){
          if(argument(instance) === false)
            instance = undefined;
        }

        else if(!instance && argument)
          throw Oops.AmbientRequired(type.name, subject, key);

        this.state.set(key, instance);
        this.update(key);
      })

      return {
        recursive: true,
        suspend: true
      }
    }
  )
};

function usePeerContext(subject: Model){
  if(ContextWasUsed.has(subject)){
    if(ContextWasUsed.get(subject))
      useLookup();

    return;
  }

  const pending = PendingContext.get(subject);

  if(pending){
    const local = useLookup();

    for(const init of pending)
      init(local);

    PendingContext.delete(subject);
  }

  ContextWasUsed.set(subject, !!pending);
}

function getPending(subject: Stateful){
  let pending = PendingContext.get(subject);

  if(!pending)
    PendingContext.set(subject, pending = []);

  return pending;
}

export { tap, usePeerContext, getPending }