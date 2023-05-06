import { Control } from '@expressive/mvc';
import { useLayoutEffect, useMemo, useState } from 'react';
import { useLookup } from './context';

const useContext: Control.GetHook = (type, factory) => {
  const context = useLookup();
  const state = useState(0);
  const hook = useMemo(() => {
    const result = factory(
      () => state[1](x => x+1),
      cb => cb(context.get(type, false))
    );

    if(!result)
      return () => null;

    return () => {
      useLayoutEffect(result.commit, []);
      return result.render();
    }
  }, []);

  return hook();   
}

export { useContext }