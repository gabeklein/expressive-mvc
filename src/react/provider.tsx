import React, { Suspense } from 'react';

import { Parent } from '../children';
import { Control } from '../control';
import { issues } from '../helper/issues';
import { values } from '../helper/object';
import { Class } from '../helper/types';
import { Model } from '../model';
import { LookupContext, useLookup } from './context';
import { getPending } from './tap';

export const Oops = issues({
  NoType: () =>
    "Provider 'for' prop must be Model, typeof Model or a collection of them."
})

declare namespace Provider {
  type Item = Model | Model.Type;

  type Multiple<T extends Item = Item> = T[] | { [key: string]: T };

  type Instance<E> = E extends Class ? InstanceType<E> : E extends Model ? E : never;

  type NormalProps<E, I = Instance<E>> = {
    for: E;
    fallback?: React.ReactNode;
    children?: React.ReactNode | ((instance: I) => React.ReactNode);
    and?: Model.Compat<I>;
  }

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> = {
    for: Multiple<T>;
    fallback?: React.ReactNode;
    children?: React.ReactNode;
    and?: Model.Compat<Instance<T>>;
  }

  type Props<T extends Item> = MultipleProps<T> | NormalProps<T>;
}

function Provider<T extends Provider.Item>(props: Provider.Props<T>){
  const context = useNewContext(props.for, props.and);

  React.useLayoutEffect(() => () => context.pop(), []);

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

function useNewContext<T extends Model>(
  include: Provider.Item | Provider.Multiple,
  assign: Model.Compat<T> | undefined){

  const ambient = useLookup();

  const context = React.useMemo(() => {
    if(!include)
      throw Oops.NoType();

    const next = ambient.push();

    function register(T: Model | Model.Type){
      const i = next.add(T);

      if(assign)
        assignWeak(i, assign);

      Control.for(i).state.forEach(value => {
        if(Parent.get(value) === i)
          next.add(value);
      });
    }

    if(include instanceof Model || typeof include == "function")
      register(include);
    else
      values(include).forEach(register);

    for(const instance of next.local)
      for(const apply of getPending(instance))
        apply(next)

    return next;
  }, []);

  if(assign)
    context.local.forEach(i => {
      if(i && !Parent.has(i))
        assignWeak(i, assign)
    });

  return context;
}

function assignWeak(into: any, from: any){
  for(const K in from)
    if(K in into)
      into[K] = from[K];
}