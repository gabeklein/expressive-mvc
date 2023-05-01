import { Context, Control, issues, Model } from '@expressive/mvc';
import React, { createContext, Suspense, useContext, useLayoutEffect, useMemo } from 'react';

import { setPeers } from './useContext';

export const LookupContext = createContext(new Context());
export const useAmbient = () => useContext(LookupContext);

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
  const { for: includes, use: assign } = props;

  const ambient = useAmbient();
  const context = useMemo(() => {
    if(includes)
      return ambient.push();

    throw Oops.NoType();
  }, []);

  addTo(context, includes, instance => {
    if(assign)
      for(const K in assign)
        if(K in instance)
          (instance as any)[K] = (assign as any)[K];
  })

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

function addTo(
  context: Context,
  items: Provider.Item | Provider.Multiple,
  callback: (model: Model) => void){

  const init = new Set<Model>();

  if(typeof items == "function" || items instanceof Model)
    items = { [0]: items };

  for(const key in items){
    const instance = context.add(items[key], key);

    init.add(instance);
    callback(instance);
  }

  for(const model of init){
    setPeers(context, model);
    Object.values(Control.ready(model).state).forEach(value => {
      if(value instanceof Model && Control.get(value).parent === model){
        context.add(value);
        init.add(value);
      }
    });
  }
}