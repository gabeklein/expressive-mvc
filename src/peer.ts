import { useLookup } from './context';
import { set } from './instructions';
import { issues } from './issues';
import { Model, Stateful } from './model';
import { Lookup } from './register';
import { Singleton } from './singleton';
import { Subscriber } from './subscriber';

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
  type: T, required?: boolean): InstanceOf<T> => set(

  function tap(key){
    const { subject } = this;
    const Proxies = new WeakMap<Subscriber, any>();
    let getInstance: () => Model | undefined;

    if("current" in type)
      getInstance = () => type.current;
    else if("current" in subject.constructor)
      throw Oops.CantAttachGlobal(subject, type.name);
    else 
      getPending(subject).push(context => {
        const remote = context.get(type);

        if(!remote && required)
          throw Oops.AmbientRequired(type.name, subject, key);
    
        getInstance = () => remote;
      })

    const attach = (sub: Subscriber) => {
      let child: Subscriber | undefined;

      function create(){
        const instance = getInstance();

        if(!instance)
          return;

        child = new Subscriber(instance, sub.onUpdate);

        if(sub.active)
          child.commit();

        sub.dependant.add(child);
        Proxies.set(sub, child.proxy);
      }

      function refresh(){
        if(child){
          child.release();
          sub.dependant.delete(child);
          Proxies.set(sub, undefined);
          child = undefined;
        }

        create();
        sub.onUpdate();
      }

      create();
      sub.follow(key, refresh);
    }

    return (local) => {
      if(!local)
        return getInstance();

      if(!Proxies.has(local))
        attach(local);

      return Proxies.get(local);
    }
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