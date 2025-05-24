import { Context } from '@expressive/mvc';

declare namespace Pragma {
  type Node = any;

  type Element = {
    type: string | Function;
    props: { [key: string]: any };
    key?: string | number;
    ref?: any;
    children?: Node | Node[];
  };

  type FC<P = {}> = (props: P) => Node;

  type Context<T = any> = {
    Provider: FC<{ value: T; children?: Node }>;
    Consumer: FC<{ children: (value: T) => Node }>;
  };
}

interface Pragma {
  useState: <S>(initialState: S | (() => S)) => [S, (value: S | ((prev: S) => S)) => void];
  useEffect: (effect: () => void | (() => void), deps?: any[]) => void;
  useContext: <T>(context: Pragma.Context<T>) => T;
  useMemo: <T>(factory: () => T, deps: any[]) => T;
  createElement: (...args: any[]) => any;
  isValidElement: (element: any) => element is Pragma.Element;
  Fragment: Pragma.FC;
  Context: Pragma.Context;
}

const Pragma = {} as Pragma;

export function useContext(): Context {
  return Pragma.useContext(Pragma.Context);
}

export function useFactory<T extends Function>(
  factory: (refresh: () => void) => T){

  const state = Pragma.useState(() => factory(() => {
    state[1](x => x.bind(null) as any);
  }));

  return state[0] as T;
}

export function createProvider(
  context: Context,
  children: Pragma.Node
): Pragma.Node {
  if(Pragma.isValidElement(children) && children.type === Pragma.Context.Provider)
    return children;
  
  return Pragma.createElement(Pragma.Context.Provider, {
    value: context,
    children
  });
}

export { Pragma };

import './model.as';
import './model.use';
import './model.get';
