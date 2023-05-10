import { Control } from '@expressive/mvc';
import { useLayoutEffect, useMemo, useState } from 'react';

import { Pending, useLookup, usePeerContext } from './context';

Control.get = (type, adapter) => {
  const context = useLookup();
  const state = useState(0);
  const hook = useMemo(() => adapter(
    () => state[1](x => x+1),
    cb => cb(context.get(type))
  ), []);

  if(!hook)
    return null;

  useLayoutEffect(hook.mount, []);

  return hook.render();
}

Control.use = (adapter) => {
  const state = useState(0);
  const hook = useMemo(() => adapter(() => state[1](x => x+1)), []);

  usePeerContext(hook.instance);
  useLayoutEffect(hook.mount, []);

  return hook.render;
}

Control.has = (type, relativeTo, callback) => {
  let pending = Pending.get(relativeTo);
    
  if(!pending)
    Pending.set(relativeTo, pending = []);

  pending.push(context => callback(context.get(type)));
};

export * from '@expressive/mvc';

export { Consumer } from "./consumer";
export { Provider } from "./provider";