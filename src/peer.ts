import { child } from './compose';
import { useLookup } from './context';
import { Stateful } from './controller';
import { issues } from './issues';
import { Model } from './model';
import { Lookup } from './register';
import { Singleton } from './singleton';

export const Oops = issues({
  CantAttachGlobal: (parent, child) =>
    `Singleton '${parent}' attempted to attach '${child}' but it is not also a singleton.`,

  AmbientRequired: (requested, requester, key) =>
    `Attempted to find an instance of ${requested} in context. It is required for [${requester}.${key}], but one could not be found.`
})

type Peer = typeof Model | typeof Singleton;
type ApplyPeer = (context: Lookup) => void;
type PeerCallback<T extends Peer> = (instance: InstanceOf<T> | undefined) => void | boolean;

const PendingContext = new WeakMap<Stateful, ApplyPeer[]>();
const ContextWasUsed = new WeakMap<Model, boolean>();

export const tap = <T extends Peer>(
  type: T, argument?: boolean | PeerCallback<T>) => child(

  function tap(key){
    if("current" in type)
      return () => type.current as InstanceOf<T>;

    const to = this.subject;

    if("current" in to.constructor)
      throw Oops.CantAttachGlobal(to, type.name);

    let instance: InstanceOf<T> | undefined;

    getPending(to).push(context => {
      instance = context.get(type);

      if(typeof argument == "function"){
        if(argument(instance) === false)
          instance = undefined;
      }

      else if(!instance && argument)
        throw Oops.AmbientRequired(type.name, to, key);
    })

    return () => instance;
  }
);

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