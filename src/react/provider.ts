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

  type Existent<E> = E extends Class ? InstanceType<E> : E extends Model ? E : never;

  type NormalProps<E, I = Existent<E>> = {
    for: E;
    children?: React.ReactNode | ((instance: I) => React.ReactNode);
    and?: Model.Compat<I>;
  }

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> = {
    for: Multiple<T>;
    children?: React.ReactNode | (() => React.ReactNode);
    and?: Model.Compat<Existent<T>>;
  }

  type Props<T extends Item> = MultipleProps<T> | NormalProps<T>;
}

function Provider<T extends Provider.Item>(props: Provider.Props<T>){
  const { children: render, for: model, and: assign } = props;
  const context = useNewContext(model, assign);

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

    const local = ambient.push();

    function register(I: Model | typeof Model){
      if(I instanceof Model)
        local.inject(I.constructor as any, I, false);
      else
        local.inject(I, I.new(), true);
    }

    if(include instanceof Model || typeof include == "function")
      register(include);
    else
      values(include).forEach(register);

    for(const instance of local.local)
      if(instance)
        for(const apply of getPending(instance))
          apply(local)

    return local;
  }, []);

  if(assign){
    type K = Model.Field<T>;
    for(const key in assign)
      for(const into of context.local as T[])
        if(into && key in into)
          into[key as K] = assign[key as K]!;
  }

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