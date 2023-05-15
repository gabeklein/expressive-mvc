import { Context, Model } from '@expressive/mvc';
import {
  createElement,
  FunctionComponentElement,
  ProviderProps,
  ReactNode,
  Suspense,
  useLayoutEffect,
  useMemo,
} from 'react';

import { LookupContext, peerContext, useLookup } from './context';

type Class = new () => any;

declare namespace Provider {
  type Item = Model | Model.New;

  type Multiple<T extends Item = Item> = { [key: string | number]: T };

  type Instance<E> = E extends Class ? InstanceType<E> : E extends Model ? E : never;

  type Props<T extends Item = Item> = MultipleProps<T> | NormalProps<T>;

  type NormalProps<E, I = Instance<E>> = {
    for: E;
    fallback?: ReactNode;
    children?: ReactNode | ((instance: I) => ReactNode);
    use?: Model.Compat<I>;
  }

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> = {
    for: Multiple<T>;
    fallback?: ReactNode;
    children?: ReactNode;
    use?: Model.Compat<Instance<T>>;
  }
}

function Provider<T extends Provider.Item>(
  props: Provider.Props<T>
): FunctionComponentElement<ProviderProps<Context>> {
  let { for: included, use: assign } = props;

  const ambient = useLookup();
  const context = useMemo(() => ambient.push(), []);

  if(typeof included == "function" || included instanceof Model)
    included = { [0]: included };

  context.include(included).forEach((explicit, model) => {
    if(assign && explicit)
      for(const K in assign)
        if(K in model)
          (model as any)[K] = (assign as any)[K];

    peerContext(model, context);
  });

  useLayoutEffect(() => () => context.pop(), []);

  return createElement(LookupContext.Provider, { value: context, key: context.key },
    props.fallback == false
      ? props.children
      : createElement(Suspense, { fallback: props.fallback || null }, props.children)
  )
}

export { Provider };