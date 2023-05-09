import { issues, Model } from '@expressive/mvc';
import React, { Suspense, useLayoutEffect, useMemo } from 'react';

import { LookupContext, Pending, useLookup } from './context';

export const Oops = issues({
  NoType: () => "Provider 'for' prop must be Model, typeof Model or a collection of them."
})

type Class = new () => any;

declare namespace Provider {
  type Item = Model | Model.New;

  type Multiple<T extends Item = Item> = { [key: string | number]: T };

  type Instance<E> = E extends Class ? InstanceType<E> : E extends Model ? E : never;

  type Props<T extends Item> = MultipleProps<T> | NormalProps<T>;

  type NormalProps<E, I = Instance<E>> = {
    for: E;
    fallback?: React.ReactNode;
    children?: React.ReactNode | ((instance: I) => React.ReactNode);
    use?: Model.Compat<I>;
  }

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> = {
    for: Multiple<T>;
    fallback?: React.ReactNode;
    children?: React.ReactNode;
    use?: Model.Compat<Instance<T>>;
  }
}

function Provider<T extends Provider.Item>(props: Provider.Props<T>){
  let { for: include, use: assign } = props;

  const ambient = useLookup();
  const context = useMemo(() => {
    if(include)
      return ambient.push();

    throw Oops.NoType();
  }, []);

  if(typeof include == "function" || include instanceof Model)
    include = { [0]: include };

  context.include(include).forEach((explicit, model) => {
    if(assign && explicit)
      for(const K in assign)
        if(K in model)
          (model as any)[K] = (assign as any)[K];

    const pending = Pending.get(model);

    if(pending)
      pending.forEach(cb => cb(context));
  });

  useLayoutEffect(() => () => context.pop(), []);

  return (
    <LookupContext.Provider value={context}>
      {props.fallback === false
        ? props.children
        : (
          <Suspense fallback={props.fallback || null}>
            {props.children}
          </Suspense>
        )
      }
    </LookupContext.Provider>
  )
}

export { Provider };