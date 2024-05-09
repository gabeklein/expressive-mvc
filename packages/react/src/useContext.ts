import { Context } from '@expressive/mvc';
import React from 'react';

const Pragma = React;

export declare namespace Pragma {
  type Node = React.ReactNode;
  type FCE<P = {}> = React.FunctionComponentElement<P>;
}

const Shared = Pragma.createContext(new Context());

const createProvider = (value: Context, children?: Pragma.Node) =>
  Pragma.createElement(Shared.Provider, { key: value.id, value }, children);

function useContext(): Context;
function useContext<T>(factory?: (context: Context) => T): T;
function useContext<T>(factory?: (context: Context) => T) {
  const ambient = Pragma.useContext(Shared)

  return factory
    ? Pragma.useMemo(() => factory(ambient), [])
    : ambient;
}

const useOnMount = (callback: () => () => void) =>
  Pragma.useEffect(() => callback(), []);

function useFactory<T extends () => unknown>(
  factory: (refresh: () => void) => T){

  const state = Pragma.useState(() => factory(() => {
    state[1](x => x.bind(null) as T);
  }));

  return state[0];
}

export { createProvider, useContext, useFactory, useOnMount };