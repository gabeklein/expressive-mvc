import { Control } from '../control';
import { issues } from '../issues';
import { Subscriber } from '../subscriber';
import { suspend } from '../suspense';
import { Callback } from '../types';

import type { get } from './get';

export const Oops = issues({
  Failed: (parent, property, initial) =>
    `An exception was thrown while ${initial ? "initializing" : "refreshing"} [${parent}.${property}].`
});

const INFO = new WeakMap<Function, string>();
const KEYS = new WeakMap<Control, Set<Callback>>();
const ORDER = new WeakMap<Control, Callback[]>();

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
    ORDER.set(self, order = []);

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
    sub = source.subscribe((_, source) => {
      if(source !== self)
        refresh();
      else
        pending.add(refresh);
    });

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
      order.push(refresh);
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

  const list = ORDER.get(control)!;

  while(pending.size){
    const [ compute ] = Array.from(pending)
      .sort((a, b) => list.indexOf(a) - list.indexOf(b));

    pending.delete(compute);

    const key = INFO.get(compute)!;

    if(!control.frame.has(key))
      compute();
  }

  pending.clear();
}