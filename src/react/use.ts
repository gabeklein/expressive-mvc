import React from 'react';

import { Callback } from '../helper/types';

export function use<T>(init: (trigger: Callback) => T){
  const [ state, update ] = React.useState((): T[] => [
    init(() => update(state.concat()))
  ]);

  return state[0];
}