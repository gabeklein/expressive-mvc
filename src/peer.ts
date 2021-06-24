import { Lookup, useLookup } from './context';
import { Model } from './model';
import { Observer } from './observer';
import { Singleton } from './singleton';
import { define, defineLazy, values } from './util';

import Oops from './issues';

type Peer = typeof Model | typeof Singleton;

const PendingContext = new Set<(context: Lookup) => void>();
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
      function insert(context: Lookup){
        const remote = context.get(type);

        if(!remote && required)
          throw Oops.AmbientRequired(type.name, Self, key);

        define(subject, key, remote);
      }

      PendingContext.add(insert);
      define(subject, key, insert);
    }
  })
}

export function usePeers(subject: Model){
  if(ContextWasUsed.has(subject)){
    if(ContextWasUsed.get(subject))
      useLookup();

    return;
  }

  const pending = values(subject)
    .filter(x => PendingContext.has(x));

  const hasPeers = pending.length > 0;

  if(hasPeers){
    const local = useLookup();
  
    for(const init of pending)
      init(local);
  }

  ContextWasUsed.set(subject, hasPeers);
}