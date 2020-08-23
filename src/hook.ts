import { useState } from 'react';

import { Controller } from './controller';
import { LivecycleEvent, useLifecycleEffect } from './lifecycle';

export function useEventDrivenController<T extends Controller>(
  init: (requestUpdate: Callback) => T
){
  const [ state, forceUpdate ] = useState({} as {
    current: T,
    onEvent: (name: LivecycleEvent) => void
  });

  let initial = false;

  if(!state.current){
    const control = state.current = 
      init(() => forceUpdate({ ...state }));

    state.onEvent = (name) => control.onEvent(name);
    initial = true;
  }

  useLifecycleEffect(state.onEvent, initial);

  return state.current;
}