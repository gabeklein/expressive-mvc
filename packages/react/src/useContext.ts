import { useLayoutEffect, useMemo, useState } from 'react';

export function useContext<T>(
  factory: (update: () => void) => void | {
    commit: () => (() => void) | void;
    render: () => T;
  }
){
  const state = useState(0);
  const hook = useMemo(() => {
    const result = factory(() => state[1](x => x+1));

    return result
      ? () => {
        useLayoutEffect(result.commit, []);
        return result.render();
      }
      : () => null;
  }, []);

  return hook();
}