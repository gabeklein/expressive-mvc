import React from 'react';

import { Control } from '../control';
import { issues } from '../issues';
import { Model } from '../model';
import { Subscriber } from '../subscriber';
import { Class } from '../types';
import { entries, values } from '../util';
import { Lookup } from './context';
import { getPending } from './tap';
import { use } from './use';
import { LookupContext, useLookup } from './useContext';

export const Oops = issues({
  NoType: () =>
    "Provider 'for' prop must be Model, typeof Model or a collection of them."
})

declare namespace Provider {
  type Item = Model | Model.Type;

  type Multiple<T extends Item = Item> = T[] | { [key: string]: T };

  type Existent<E> = E extends Class ? InstanceType<E> : E extends Model ? E : never;

  type NormalProps<E, I = Existent<E>> =
    & {
      for: E;
      children?: React.ReactNode | ((instance: I) => React.ReactNode);
    }
    & Model.Compat<I>;

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> =
    & {
      for: Multiple<T>;
      children?: React.ReactNode | (() => React.ReactNode);
    }
    & Model.Compat<Existent<T>>;

  type Props<T extends Item> = MultipleProps<T> | NormalProps<T>;
}

function Provider<T extends Provider.Item>(props: Provider.Props<T>){
  const context = useNewContext(props.for);
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
  include: Provider.Item | Provider.Multiple){

  const ambient = useLookup();

  return React.useMemo(() => {
    if(!include)
      throw Oops.NoType();

    const layer = ambient.push();

    function register(I: Model | typeof Model){
      if(I instanceof Model)
        layer.inject(I.constructor as any, I, false);
      else
        layer.inject(I, I.create(), true);
    }

    if(include instanceof Model || typeof include == "function")
      register(include);
    else
      values(include).forEach(register);

    for(const instance of layer.local)
      if(instance)
        for(const apply of getPending(instance))
          apply(layer)

    return layer;
  }, []);
}

function useAppliedProps(context: Lookup, props: {}){
  const apply = React.useMemo(() => {
    return (props: {}) => {
      entries(props).forEach(([key, value]) => {
        if(key == "for" || key == "children")
          return;

        for(const into of context.local)
          if(into && key in into)
            (into as any)[key] = value;
      })
    };
  }, []);

  apply(props);
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