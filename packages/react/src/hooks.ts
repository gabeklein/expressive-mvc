import { Control, Model } from '@expressive/mvc';
import { useLayoutEffect, useMemo, useState } from 'react';
import { useLookup, usePeerContext } from './context';

export const getModel: Control.GetHook = (type, adapter) => {
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

export const useModel: Control.UseHook = (adapter) => {
  const state = useState(0);
  const hook = useMemo(() => (
    adapter(() => state[1](x => x+1))
  ), []);

  usePeerContext(hook.instance);
  useLayoutEffect(hook.mount, []);

  return hook.render;
}

export function tapModel <T extends Model, R>(
  type: Model.Type<T>,
  memo: (got: T | undefined) => R
){
  const context = useLookup();
  return useMemo(() => memo(context.get(type)), []);
}