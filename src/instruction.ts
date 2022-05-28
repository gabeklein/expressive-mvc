import { Controller } from './controller';
import { Pending } from './instruction/apply';
import { Instruction } from './instruction/types';
import { LOCAL, Model } from './model';
import { Subscriber } from './subscriber';
import { suspend } from './suspense';
import { defineProperty } from './util';

export function apply(
  on: Controller,
  key: Model.Field<any>,
  placeholder: symbol){

  const instruction = Pending.get(placeholder);

  if(!instruction)
    return;

  const { proxy, state, subject } = on;

  let onGet: Instruction.Getter<any> | undefined;
  let onSet: Instruction.Setter<any> | false | undefined;
  let set: ((value: any) => void) | undefined;
  let enumerable: any;
  let suspense: boolean | undefined;

  Pending.delete(placeholder);
  delete subject[key];
  const desc = instruction.call(on, key, on);

  if(desc === false)
    return;

  if(typeof desc == "object"){
    if("value" in desc)
      state[key] = desc.value as any;

    onSet = desc.set;
    onGet = desc.get;
    suspense = desc.suspense;
    enumerable = desc.enumerable;
  }

  if(onSet !== false)
    set = on.ref(key, onSet);

  const get = (local?: Subscriber) => {
    if(!(key in state) && suspense)
      throw suspend(on, key);

    const value = state[key];

    if(onGet)
      return local
        ? onGet(value, local)
        : onGet(value)

    return value;
  }

  defineProperty(subject, key, {
    enumerable, set, get
  });

  defineProperty(proxy, key, {
    enumerable, set,
    get(){
      const local = this[LOCAL];

      if(local && !local.watch[key])
        local.watch[key] = true;

      return get(local);
    }
  });
}