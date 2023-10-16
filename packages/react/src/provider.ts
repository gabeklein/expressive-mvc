import { Context, Model } from '@expressive/mvc';
import React from 'react';

import { createContext, setContext, useContext } from './useContext';

import type { FunctionComponentElement, ReactNode } from 'react';

interface ProviderProps<T> {
  value: T;
  children?: ReactNode | undefined;
}

declare namespace Provider {
  type Element = FunctionComponentElement<ProviderProps<Context>>;

  type Item = Model | Model.New;

  type Multiple<T extends Item = Item> = { [key: string | number]: T };

  type Instance<E> = E extends (new () => any) ? InstanceType<E> : E extends Model ? E : never;

  type Props<T extends Item = Item> = MultipleProps<T> | NormalProps<T>;

  type NormalProps<E, I = Instance<E>> = {
    for: E;
    //TODO: use a more strict type for this
    children?: unknown;
    use?: Model.Values<I>;
  }

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> = {
    for: Multiple<T>;
    //TODO: use a more strict type for this
    children?: unknown;
    use?: Model.Values<Instance<T>>;
  }
}

function Provider<T extends Provider.Item>(props: Provider.Props<T>): Provider.Element {
  let { for: included, use: assign } = props;

  const context = useContext();
  const value = React.useMemo(() => context.push(), []);

  if(typeof included == "function" || included instanceof Model)
    included = { [0]: included };

  else if(!included)
    reject(included);

  Object.entries(included).forEach(([K, V]) => {
    if(!(Model.is(V) || V instanceof Model))
      reject(`${V} as ${K}`);
  })
  
  value.include(included).forEach((isExplicit, model) => {
    if(assign && isExplicit)
      for(const K in assign)
        if(K in model)
          (model as any)[K] = (assign as any)[K];

    setContext(model, value);
  });

  React.useEffect(() => () => value.pop(), []);

  return createContext(value, props.children as ReactNode);
}

function reject(argument: any){
  throw new Error(`Provider expects a Model instance or class but got ${argument}.`);
}

export { Provider };