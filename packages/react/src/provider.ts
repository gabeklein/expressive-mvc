import { Context, Model } from '@expressive/mvc';
import { createElement, useContext, useEffect, useMemo } from 'react';

import { Shared, setContext } from './useLocal';

import type { FunctionComponentElement, ProviderProps, ReactNode } from 'react';

declare namespace Provider {
  type Element = FunctionComponentElement<ProviderProps<Context>>;

  type Item = Model | Model.New;

  type Multiple<T extends Item = Item> = { [key: string | number]: T };

  type Instance<E> = E extends (new () => any) ? InstanceType<E> : E extends Model ? E : never;

  type Props<T extends Item = Item> = MultipleProps<T> | NormalProps<T>;

  type NormalProps<E, I = Instance<E>> = {
    for: E;
    children?: ReactNode;
    use?: Model.Values<I>;
  }

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> = {
    for: Multiple<T>;
    children?: ReactNode;
    use?: Model.Values<Instance<T>>;
  }
}

function Provider<T extends Provider.Item>(
  props: Provider.Props<T>): Provider.Element {

  let { for: included, use: assign, children } = props;

  const context = useContext(Shared)
  const value = useMemo(() => context.push(), []);

  if(!included)
    reject(included);

  if(typeof included == "function" || included instanceof Model)
    included = { [0]: included };

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

  useEffect(() => () => value.pop(), []);

  return createElement(Shared.Provider, { key: value.key, value }, children);
}

function reject(argument: any){
  throw new Error(`Provider expects a Model instance or class but got ${argument}.`);
}

export { Provider };