import { Model } from '@expressive/mvc';
import { useLayoutEffect, useMemo, useState } from 'react';

import { Pending, useLookup } from './context';

export function useModel<T extends Model>(
  factory: (update: () => void) => {
    instance: T;
    commit: () => (() => void) | void;
    render: (props: Model.Compat<T>) => T;
  },
  props: Model.Compat<T>
){
  const state = useState(0);
  const hook = useMemo(() => {
    const refresh = () => state[1](x => x+1);
    const { commit, instance, render } = factory(refresh);

    let applyPeers: undefined | boolean;

    return (props: Model.Compat<T>) => {
      if(applyPeers)
        useLookup();

      else if(applyPeers !== false){
        const pending = Pending.get(instance);
      
        if(applyPeers = !!pending){
          const local = useLookup();

          pending.forEach(init => init(local));
          Pending.delete(instance);
        }
      }

      useLayoutEffect(commit, []);

      return render(props);
    }
  }, []);

  return hook(props);
}