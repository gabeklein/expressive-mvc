import { Control } from '../control';
import { issues } from '../helper/issues';
import { Callback } from '../helper/types';
import { Subscriber } from '../subscriber';
import { suspend } from '../suspense';

import type { get } from './get';

export const Oops = issues({
  Failed: (parent, property, initial) =>
    `An exception was thrown while ${initial ? "initializing" : "refreshing"} [${parent}.${property}].`
});

const INFO = new WeakMap<Callback, string>();
const KEYS = new WeakMap<Control, Set<Callback>>();
const ORDER = new WeakMap<Control, Map<Callback, number>>();

export function computeMode(
  self: Control,
  source: Control,
  setter: get.Function<any, any>,
  key: string,
  required: boolean
){
  const { subject, state } = self;

  let sub: Subscriber;
  let order = ORDER.get(self)!;
  let pending = KEYS.get(self)!

  if(!order)
    ORDER.set(self, order = new Map());

  if(!pending)
    KEYS.set(self, pending = new Set());

  const compute = (initial: boolean) => {
    try {
      return setter.call(sub.proxy, sub.proxy);
    }
    catch(err){
      Oops.Failed(subject, key, initial).warn();
      throw err;
    }
  }

  const refresh = () => {
    let value;

    try {
      value = compute(false);
    }
    catch(e){
      console.error(e);
    }
    finally {
      if(state.get(key) !== value){
        state.set(key, value);
        self.update(key);
        return value;
      }
    }
  }

  const create = () => {
    sub = new Subscriber(source, (_, source) => {
      if(source !== self)
        refresh();
      else
        pending.add(refresh);
    });

    sub.watch.set(key, false);

    try {
      const value = compute(true);
      state.set(key, value);
      return value;
    }
    catch(e){
      throw e;
    }
    finally {
      sub.commit();
      order.set(refresh, order.size);
    }
  }

  INFO.set(refresh, key);

  return () => {
    if(pending.has(refresh)){
      pending.delete(refresh)
      refresh();
    }

    const value = sub ? state.get(key) : create();

    if(value === undefined && required)
      throw suspend(self, key);

    return value;
  }
}

export function flush(control: Control){
  const pending = KEYS.get(control);

  if(!pending || !pending.size)
    return;

  const priority = ORDER.get(control)!;

  while(pending.size){
    let compute!: Callback;

    for(const item of pending)
      if(!compute || priority.get(item)! < priority.get(compute)!)
        compute = item;

    pending.delete(compute);

    const key = INFO.get(compute)!;

    if(!control.frame.has(key))
      compute();
  }

  pending.clear();
}