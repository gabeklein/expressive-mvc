import { getRecursive } from '../children';
import { issues } from '../helper/issues';
import { add } from '../instruction/add';
import { Model } from '../model';
import { Lookup, useLookup } from './context';
import { MVC } from './mvc';

export const Oops = issues({
  NotAllowed: (parent, child) =>
    `Global '${parent}' attempted to attach '${child}' but it is not also a singleton.`,

  AmbientRequired: (requested, requester, key) =>
    `Attempted to find an instance of ${requested} in context. It is required for [${requester}.${key}], but one could not be found.`
})

const Pending = new WeakMap<{}, ((context: Lookup) => void)[]>();
const Applied = new WeakMap<Model, boolean>();

declare namespace tap {
  type Callback<T extends Model> = (instance: T | undefined) => void | boolean;
}

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
function tap <T extends Model> (Type: Model.Type<T>, callback?: (instance?: T) => void | true): T;
function tap <T extends Model> (Type: Model.Type<T>, callback?: (instance?: T) => void | boolean): T | undefined;

/**
 * Find and attach most applicable instance of Model via context.
 *
 * Expects a `<Provider>` of target controller to exist. 
 * Host controller will search element-hierarchy relative to where it spawned.
 *
 * @param Type - Type of controller to attach to property. 
 * @param required - Throw if instance of Type cannot be found.
 */
function tap <T extends Model> (Type: Model.Type<T>, required: true): T;
function tap <T extends Model> (Type: Model.Type<T>, required?: boolean): T | undefined;

function tap<T extends MVC>(
  type: Model.Type<T>,
  argument?: boolean | tap.Callback<T>){

  return add(
    function tap(key){
      const { subject, state } = this;

      findRelative(subject, type, instance => {
        if(typeof argument == "function"){
          if(argument(instance) === false)
            instance = undefined;
        }
        else if(!instance && argument)
          throw Oops.AmbientRequired(type.name, subject, key);

        state.set(key, instance);
        this.update(key);
      })

      return getRecursive(key, this);
    }
  )
};

export function findRelative<T extends Model>(
  from: Model,
  type: Model.Type<T>,
  callback: (got: T | undefined) => void){

  if(MVC.isTypeof(type) && type.global)
    callback(type.get());
  else if((from as any).constructor.global)
    throw Oops.NotAllowed(from, type.name)
  else
    getPending(from).push(context => {
      callback(context.get<T>(type));
    })
}

function usePeerContext(subject: Model){
  if(Applied.has(subject)){
    if(Applied.get(subject))
      useLookup();

    return;
  }

  const pending = Pending.get(subject);

  if(pending){
    const local = useLookup();

    for(const init of pending)
      init(local);

    Pending.delete(subject);
  }

  Applied.set(subject, !!pending);
}

function getPending(subject: {}){
  let pending = Pending.get(subject);

  if(!pending)
    Pending.set(subject, pending = []);

  return pending;
}

export { tap, usePeerContext, getPending }