import { Control } from '@expressive/mvc';
import { useLayoutEffect, useMemo, useState } from 'react';

import { getPeerContext, useLookup, usePeerContext } from './context';

Control.has = getPeerContext;

Control.get = (adapter) => {
  const context = useLookup();
  const state = useState(0);
  const hook = useMemo(() => adapter(state[1], context), []);

  if(!hook)
    return null;

  useLayoutEffect(hook.mount, []);

  return hook.render();
}

Control.use = (adapter) => {
  const state = useState(0);
  const hook = useMemo(() => adapter(state[1]), []);

  usePeerContext(hook.instance);
  useLayoutEffect(hook.mount, []);

  return hook.render;
}

export {
  Context,
  Control,
  Debug,
  default,
  get,
  Model,
  ref,
  run,
  set,
  use,
} from '@expressive/mvc';

export { Consumer } from "./consumer";
export { Provider } from "./provider";