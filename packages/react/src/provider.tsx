import { Control, issues, Model } from '@expressive/mvc';
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

  const init = new Set<Model>();
  const ambient = useLookup();
  const context = useMemo(() => {
    if(include)
      return ambient.push();

    throw Oops.NoType();
  }, []);

  if(typeof include == "function" || include instanceof Model)
    include = { [0]: include };

  for(const key in include){
    const instance = context.add(include[key], key);

    init.add(instance);

    if(assign)
      for(const K in assign)
        if(K in instance)
          (instance as any)[K] = (assign as any)[K];
  }

  for(const model of init){
    const control = Control.for(model, true);
    const pending = Pending.get(model);
  
    if(pending)
      pending.forEach(cb => cb(context));

    Object.values(control.state).forEach(value => {
      if(value instanceof Model && Control.for(value).parent === model){
        context.add(value);
        init.add(value);
      }
    });
  }

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