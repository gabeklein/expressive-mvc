import { useLookup } from './context';
import { set } from './instructions';
import { issues } from './issues';
import { Model, Stateful } from './model';
import { Lookup } from './register';
import { Singleton } from './singleton';
import { define, defineLazy } from './util';

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

export function tap<T extends Peer>(
  type: T, required?: boolean){

  return set<InstanceOf<T>>(({ subject }, key) => {
    if("current" in type)
      defineLazy(subject, key, () => type.current);
    else if("current" in subject.constructor)
      throw Oops.CantAttachGlobal(subject, type.name);
    else
      registerPeer(subject, type, key, required);
  }, "tap");
}

function registerPeer(
  subject: Stateful,
  type: typeof Model,
  key: string,
  required?: boolean
){
  let pending = PendingContext.get(subject);

  if(!pending)
    PendingContext.set(subject, pending = []);

  pending.push((context: Lookup) => {
    const remote = context.get(type);

    if(!remote && required)
      throw Oops.AmbientRequired(type.name, subject, key);

    define(subject, key, remote);
  });
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

export function applyParallel(context: Lookup){
  for(const instance of context.local){
    const pending = PendingContext.get(instance);

    if(pending)
      pending.forEach(cb => cb(context));
  }
}