import { child } from './compose';
import { useLookup } from './context';
import { issues } from './issues';
import { Model, Stateful } from './model';
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

const PendingContext = new WeakMap<Stateful, ApplyPeer[]>();
const ContextWasUsed = new WeakMap<Model, boolean>();

export const tap = <T extends Peer>(
  type: T, required?: boolean) => child(

  function tap(key){
    const to = this.subject;
    let getInstance: () => InstanceOf<T> | undefined;

    if("current" in type)
      getInstance = () => type.current as InstanceOf<T>;
    else if("current" in to.constructor)
      throw Oops.CantAttachGlobal(to, type.name);
    else 
      getPending(to).push(context => {
        const remote = context.get(type);

        if(!remote && required)
          throw Oops.AmbientRequired(type.name, to, key);
    
        getInstance = () => remote;
      })

    return () => getInstance();
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