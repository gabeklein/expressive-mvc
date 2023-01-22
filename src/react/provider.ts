import React from 'react';

import { Control } from '../control';
import { issues } from '../helper/issues';
import { values } from '../helper/object';
import { Class } from '../helper/types';
import { Model } from '../model';
import { Subscriber } from '../subscriber';
import { Lookup, LookupContext, useLookup } from './context';
import { getPending } from './tap';
import { use } from './use';

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
    children?: React.ReactNode | ((instance: I) => React.ReactNode);
    and?: Model.Compat<I>;
  }

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> = {
    for: Multiple<T>;
    children?: React.ReactNode | (() => React.ReactNode);
    and?: Model.Compat<Instance<T>>;
  }

  type Props<T extends Item> = MultipleProps<T> | NormalProps<T>;
}

function Provider<T extends Provider.Item>(props: Provider.Props<T>){
  const context = useNewContext(props.for, props.and);
  const render = props.children;

  React.useLayoutEffect(() => () => context.pop(), []);

  return React.createElement(LookupContext.Provider, { value: context },
    typeof render == "function"
      ? React.createElement(RenderFunction, { context, render })
      : render
  );
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

    if(include instanceof Model || typeof include == "function")
      next.add(include);
    else
      values(include).forEach(x => next.add(x));

    for(const instance of next.local)
      if(instance){
        if(assign)
          assignWeak(instance, assign);

        for(const apply of getPending(instance))
          apply(next)
      }

    return next;
  }, []);

  if(assign)
    for(const into of context.local as T[])
      assignWeak(into, assign);

  return context;
}

interface RenderFunctionProps {
  context: Lookup;
  render: Function;
}

function RenderFunction(props: RenderFunctionProps): any {
  const hook = use(refresh => {
    const targets = props.context.local;

    if(targets.length == 1)
      return Control.for(targets[0]).subscribe(() => refresh);

    return {} as Subscriber;
  });

  if(hook.commit)
    React.useLayoutEffect(hook.commit, []);

  return props.render(hook.proxy);
}

function assignWeak(into: any, from: any){
  for(const K in from)
    if(K in into)
      into[K] = from[K];
}