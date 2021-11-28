import { useLayoutEffect, useMemo } from 'react';

import { Model } from './model';
import { Subscriber } from './subscriber';
import { values } from './util';

export const Lifecycle = {
  WILL_RENDER: "willRender",
  WILL_UPDATE: "willUpdate",
  WILL_MOUNT: "willMount",
  WILL_UNMOUNT: "willUnmount",
  DID_MOUNT: "didMount"
} as const;

export type Event = ValuesOf<typeof Lifecycle>;

export const lifecycleEvents = [
  "didCreate",
  "willDestroy",
  ...values(Lifecycle)
];

export function lifecycle(prefix: string){
  const type = eventsFor(prefix);

  return function useLifecycle(
    sub: Subscriber, tag?: Key | KeyFactory<any>){

    const emit = useMemo(() => {
      const subject = sub.source as Model;
      const id = typeof tag == "function" ? tag(subject) : tag;
      
      return (name: Event) => {
        for(const key of [name, type(name)])
          subject.update(key, id);
      }
    }, [sub, tag]);

    emit(Lifecycle.WILL_RENDER);
    emit(sub.active
      ? Lifecycle.WILL_UPDATE
      : Lifecycle.WILL_MOUNT  
    )
  
    useLayoutEffect(() => {
      sub.commit();
      emit(Lifecycle.DID_MOUNT);
  
      return () => {
        emit(Lifecycle.WILL_UNMOUNT);
        sub.release();
      }
    }, [sub]);
  }
}

function eventsFor(prefix: string){
  const map = new Map<Event, Event>();

  for(const name of values(Lifecycle)){
    const alias = prefix + name[0].toUpperCase() + name.slice(1);

    lifecycleEvents.push(alias);
    map.set(name, alias as Event);
  }

  return (e: Event) => map.get(e)!;
}