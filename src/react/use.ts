import React from 'react';

import { Callback } from '../helper/types';

export function use<T>(init: (trigger: Callback) => T){
  const $ = React.useState((): T[] => [
    init(() => $[1]($[0].concat()))
  ]);

  return $[0][0];
}