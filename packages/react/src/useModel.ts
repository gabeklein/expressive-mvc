import { Model } from '@expressive/mvc';
import { useLayoutEffect, useMemo, useState } from 'react';

import { usePeerContext } from './context';

export function useModel<T extends Model>(
  adapter: (update: () => void) => {
    instance: T;
    mount: () => (() => void) | void;
    render: (props: Model.Compat<T>) => T;
  }
){
  const state = useState(0);
  const hook = useMemo(() => (
    adapter(() => state[1](x => x+1))
  ), []);

  usePeerContext(hook.instance);
  useLayoutEffect(hook.mount, []);

  return hook.render;
}