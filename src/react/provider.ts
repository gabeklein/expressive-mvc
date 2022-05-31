import React from 'react';

import { issues } from '../issues';
import { Model } from '../model';
import { Collection, Lookup } from '../register';
import { Subscriber } from '../subscriber';
import { Class } from '../types';
import { entries } from '../util';
import { getPending } from './tap';
import { use } from './use';
import { LookupContext, useLookup } from './useLocal';

export const Oops = issues({
  NoProviderType: () =>
    `Provider 'of' prop must be Model, typeof Model or a collection of them.`
})

declare namespace Provider {
  type Item = Model | typeof Model;
  type Collection<T extends Item> = T[] | { [key: string]: T };
  type Existent<E> = E extends Class ? InstanceType<E> : E extends Model ? E : never;
  
  type NormalProps<E, I = Existent<E>> =
      & { of: E, children: React.ReactNode | ((instance: I) => React.ReactNode) }
      & Model.Compat<I>;

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> =
      & { of: Collection<T>, children?: React.ReactNode | (() => React.ReactNode) }
      & Model.Compat<Existent<T>>;

  type Props<T extends Item> = MultipleProps<T> | NormalProps<T>;
}

function Provider<T extends Provider.Item>(props: Provider.Props<T>){
  const context = useNewContext(props.of);
  const render = props.children;

  useAppliedProps(context, props);
  React.useLayoutEffect(() => () => context.pop(), []);

  return React.createElement(LookupContext.Provider, { value: context },
    typeof render == "function"
      ? React.createElement(RenderFunction, { context, render })
      : render
  );
}

export { Provider };

function useNewContext(
  inject?: Model | typeof Model | Collection){

  const from = useLookup();

  return React.useMemo(() => {
    if(!inject)
      throw Oops.NoProviderType();
    
    const context = from.push(inject);

    for(const instance of context.local)
      if(instance)
        for(const apply of getPending(instance))
          apply(context)

    return context;
  }, []);
}

function useAppliedProps(within: Lookup, props: {}){
  const update = React.useMemo(() => {
    const targets = within.local;

    return function integrate(props: {}){
      for(const [key, value] of entries(props))
        if(key != "of" && key != "children")
          for(const into of targets)
            if(into && key in into)
              (into as any)[key] = value;
    };
  }, []);

  update(props);
}

interface RenderFunctionProps {
  context: Lookup;
  render: Function;
}

function RenderFunction(props: RenderFunctionProps): any {
  const hook = use(refresh => {
    const targets = props.context.local;

    if(targets.length == 1)
      return new Subscriber(targets[0], () => refresh);

    return {} as Subscriber;
  });

  if(hook.commit)
    React.useLayoutEffect(hook.commit, []);

  return props.render(hook.proxy);
}