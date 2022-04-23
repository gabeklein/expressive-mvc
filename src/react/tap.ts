import { child } from '../instruction/child';
import { Peer, PeerCallback, pendingAccess } from './peer';

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
function tap <T extends Class> (Type: T, callback?: (instance?: InstanceOf<T>) => void | false): InstanceOf<T> | undefined;

/**
 * Find and attach most applicable instance of Model via context.
 *
 * Expects a `<Provider>` of target controller to exist. 
 * Host controller will search element-hierarchy relative to where it spawned.
 *
 * @param Type - Type of controller to attach to property. 
 * @param required - Throw if instance of Type cannot be found.
 */
function tap <T extends Class> (Type: T, required?: boolean): InstanceOf<T>;

function tap<T extends Peer>(
  type: T, argument?: boolean | PeerCallback<T>){

  return child(
    function tap(key){
      return {
        get: pendingAccess(this.subject, type, key, argument)
      }
    }
  )
};

export { tap }