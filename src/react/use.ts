import React from 'react';

import { Callback } from '../helper/types';

export function use<T>(
  init: (trigger: Callback) => T,
  deps: (string | number)[]){

  const state = React.useState(0);

  return React.useMemo(() => {
    return init(state[1].bind(null, x => x+1));
  }, deps);
}