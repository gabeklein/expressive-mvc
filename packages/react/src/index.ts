import { Context, Control, Model } from '@expressive/mvc';
import { useLayoutEffect, useMemo, useState } from 'react';

import { Pending, useLookup } from './provider';

const Applied = new WeakMap<Model, Context>();

Control.use = (adapter) => {
  const state = useState(0);
  const hook = useMemo(() => adapter(state[1]), []);
  const applied = Applied.get(hook.instance);

  if(applied)
    useLookup();

  else if(applied === undefined){
    const pending = Pending.get(hook.instance);

    if(pending){
      const local = useLookup();

      pending.forEach(init => init(local));
      Applied.set(hook.instance, local);
      Pending.delete(hook.instance);
    }
  }

  useLayoutEffect(hook.mount, []);

  return hook.render;
}

Control.get = (adapter) => {
  const context = useLookup();
  const state = useState(0);
  const hook = useMemo(() => adapter(state[1], context), []);

  if(!hook)
    return null;

  useLayoutEffect(hook.mount, []);

  return hook.render();
}

Control.has = (model) => {
  let pending = Pending.get(model)!;

  if(!pending)
    Pending.set(model, pending = []);

  return (callback: (got: Context) => void) => {
    const applied = Applied.get(model);

    if(applied)
      callback(applied);
    else
      pending.push(callback);
  }
};

export * from '@expressive/mvc';

export { Model, Model as default };
export { Consumer } from "./consumer";
export { Provider } from "./provider";