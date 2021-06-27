import { Lookup, useLookup } from './context';
import { Stateful } from './controller';
import { Model } from './model';
import { Observer } from './observer';
import { Singleton } from './singleton';
import { define, defineLazy } from './util';

import Oops from './issues';

type Peer = typeof Model | typeof Singleton;
type ApplyPeer = (context: Lookup) => void;

const PendingContext = new WeakMap<Stateful, ApplyPeer[]>();
const ContextWasUsed = new WeakMap<Model, boolean>();

export function setPeer<T extends Peer>
  (type: T, required?: boolean): InstanceOf<T> {

  return Observer.define((key, { subject }) => {
    const Self = subject.constructor.name;

    if("current" in type)
      defineLazy(subject, key, () => type.current);
    else if("current" in subject.constructor)
      throw Oops.CantAttachGlobal(subject.constructor.name, type.name);
    else {
      let pending = PendingContext.get(subject);

      if(!pending)
        PendingContext.set(subject, pending = []);

      function insert(context: Lookup){
        const remote = context.get(type);

        if(!remote && required)
          throw Oops.AmbientRequired(type.name, Self, key);

        define(subject, key, remote);
      }

      pending.push(insert);
    }
  })
}

export function usePeers(subject: Model){
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