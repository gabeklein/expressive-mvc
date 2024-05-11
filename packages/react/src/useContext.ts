import { Context } from '@expressive/mvc';
import React from 'react';

export const Shared = React.createContext(new Context());

export function useContext(){
  return React.useContext(Shared);
}

export function useFactory<T extends () => unknown>(
  factory: (refresh: () => void) => T){

  const state = React.useState(() => factory(() => {
    state[1](x => x.bind(null) as T);
  }));

  return state[0];
}

export function useMount(callback: () => () => void) {
  return React.useEffect(() => callback(), []);
}