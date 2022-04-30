import { issues } from '../issues';
import { Model, Stateful } from '../model';
import { Lookup } from '../register';
import { InstanceOf } from '../types';
import { Global } from './global';
import { useLookup } from './useInContext';

export const Oops = issues({
  CantAttachGlobal: (parent, child) =>
    `Global '${parent}' attempted to attach '${child}' but it is not also a singleton.`,

  AmbientRequired: (requested, requester, key) =>
    `Attempted to find an instance of ${requested} in context. It is required for [${requester}.${key}], but one could not be found.`
})

export type Peer = typeof Model | typeof Global;
export type ApplyPeer = (context: Lookup) => void;
export type PeerCallback<T extends Peer> = (instance: InstanceOf<T> | undefined) => void | boolean;

const PendingContext = new WeakMap<Stateful, ApplyPeer[]>();
const ContextWasUsed = new WeakMap<Model, boolean>();

export function pendingAccess<T extends Peer>(
  recipient: Stateful,
  targetType: T,
  key: string,
  argument?: boolean | PeerCallback<T>){

  if("set" in targetType)
    return () => targetType.get() as InstanceOf<T>;

  if("set" in recipient.constructor)
    throw Oops.CantAttachGlobal(recipient, targetType.name);

  let instance: InstanceOf<T> | undefined;

  getPending(recipient).push(context => {
    instance = context.get(targetType);

    if(typeof argument == "function"){
      if(argument(instance) === false)
        instance = undefined;
    }

    else if(!instance && argument)
      throw Oops.AmbientRequired(targetType.name, recipient, key);
  })

  return () => instance;
}

export function usePeerContext(subject: Model){
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

export function getPending(subject: Stateful){
  let pending = PendingContext.get(subject);

  if(!pending)
    PendingContext.set(subject, pending = []);

  return pending;
}