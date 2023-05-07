import { Control } from '@expressive/mvc';
import { useLayoutEffect, useMemo, useState } from 'react';
import { useLookup } from './context';

const useContext: Control.GetHook = (type, adapter) => {
  const context = useLookup();
  const state = useState(0);
  const hook = useMemo(() => {
    return adapter(
      () => state[1](x => x+1),
      cb => cb(context.get(type))
    )
  }, []);

  if(!hook)
    return null;

  useLayoutEffect(hook.mount, []);

  return hook.render();
}

export { useContext }