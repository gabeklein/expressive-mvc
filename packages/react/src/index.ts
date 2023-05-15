import { Control, Model } from '@expressive/mvc';
import { useLayoutEffect, useMemo, useState } from 'react';

import { hasContext, useLookup, usePeerContext } from './context';

Control.has = hasContext;

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
  get,
  ref,
  run,
  set,
  use,
} from '@expressive/mvc';

export {
  Model,
  Model as default
}

export { Consumer } from "./consumer";
export { Provider } from "./provider";