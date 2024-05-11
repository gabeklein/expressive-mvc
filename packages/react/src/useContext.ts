import { Context } from '@expressive/mvc';
import React from 'react';

const Pragma = React;

export declare namespace Pragma {
  type Node = React.ReactNode;
  type FCE<P = {}> = React.FunctionComponentElement<P>;
}

const Shared = Pragma.createContext(new Context());

function createProvider(value: Context, children?: Pragma.Node) {
  return Pragma.createElement(Shared.Provider, { key: value.id, value }, children);
}

function useContextMemo<T>(factory: (context: Context) => T) {
  const ambient = Pragma.useContext(Shared);
  return Pragma.useMemo(() => factory(ambient), []);
}

function useContextState<T extends () => unknown>(
  factory: (context: Context, refresh: () => void) => T){

  const context = Pragma.useContext(Shared);
  const state = Pragma.useState(() => factory(context, () => {
    state[1](x => x.bind(null) as T);
  }));

  return state[0];
}

function useOnMount(callback: () => () => void) {
  return Pragma.useEffect(() => callback(), []);
}

export { createProvider, useContextMemo, useContextState, useOnMount };