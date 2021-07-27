import { useLayoutEffect, useMemo } from 'react';

import { Subscriber } from './subscriber';
import { fn, values } from './util';

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
  const map = new Map<Event, Event>();

  for(const name of values(Lifecycle)){
    const alias = prefix + name[0].toUpperCase() + name.slice(1);

    lifecycleEvents.push(alias);
    map.set(name, alias as Event);
  }

  return function useLifecycle(
    sub: Subscriber, tag?: Key | KeyFactory<any>){

    const emit = useMemo(() => {
      const { parent } = sub;
      const { subject } = parent;
      const reference = fn(tag) ? tag(subject) : tag;
      
      return (name: Event) => {
        for(const key of [name, map.get(name)!]){
          const handler = (subject as any)[key];
      
          if(handler)
            handler.call(subject, reference);
      
          parent.update(key);
        }
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