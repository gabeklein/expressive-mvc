import { Context, Model } from '@expressive/mvc';

import { createContext, setContext, useContext, useEffect, useMemo } from './useContext';

import type { FunctionComponentElement, ReactNode } from 'react';

type Node = JSX.Element | Iterable<Node> | string | number | boolean | null | undefined;

declare namespace Provider {
  type Element = FunctionComponentElement<{
    value: Context;
    children?: ReactNode;
  }>;

  type Item = Model | Model.New;

  type Multiple<T extends Item = Item> = { [key: string | number]: T };

  type Instance<E> = E extends (new () => any) ? InstanceType<E> : E extends Model ? E : never;

  type Props<T extends Item = Item> = MultipleProps<T> | NormalProps<T>;

  type NormalProps<E, I = Instance<E>> = {
    for: E;
    children?: Node;
    use?: Model.Values<I>;
  }

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> = {
    for: Multiple<T>;
    children?: Node;
    use?: Model.Values<Instance<T>>;
  }
}

function Provider<T extends Provider.Item>(props: Provider.Props<T>): Provider.Element {
  let { for: included, use: assign } = props;

  const ambient = useContext();
  const context = useMemo(() => ambient.push(), []);
  
  context.include(included).forEach((isExplicit, model) => {
    if(assign && isExplicit)
      for(const K in assign)
        if(K in model)
          model.set(K, (assign as any)[K]);

    setContext(model, context);
  });

  useEffect(() => () => context.pop(), []);

  return createContext(context, props.children);
}

export { Provider };