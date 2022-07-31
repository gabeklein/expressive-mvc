import React from 'react';

import { ensure } from '../controller';
import { issues } from '../issues';
import { Model } from '../model';
import { Lookup } from '../register';
import { Subscriber } from '../subscriber';
import { Class } from '../types';
import { entries, values } from '../util';
import { getPending } from './tap';
import { use } from './use';
import { LookupContext, useLookup } from './useLocal';

export const Oops = issues({
  NoType: () =>
    "Provider 'of' prop must be Model, typeof Model or a collection of them.",

  PropDeprecated: () =>
    "Provider `of` prop is deprecated, use `for` instead."
})

declare namespace Provider {
  type Item = Model | typeof Model;
  type Collection<T extends Item> = T[] | { [key: string]: T };
  type Existent<E> = E extends Class ? InstanceType<E> : E extends Model ? E : never;

  type NormalProps<E, I = Existent<E>> =
      & {
        /** @deprecated use for instead. */
        of?: never;
        for: E;
        children: React.ReactNode | ((instance: I) => React.ReactNode);
      }
      & Model.Compat<I>;

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> =
      & {
        /** @deprecated use for instead. */
        of?: never;
        for: Collection<T>;
        children?: React.ReactNode | (() => React.ReactNode);
      }
      & Model.Compat<Existent<T>>;

  type Props<T extends Item> = MultipleProps<T> | NormalProps<T>;
}

function Provider<T extends Provider.Item>(props: Provider.Props<T>){
  if("of" in props)
    throw Oops.PropDeprecated();

  const from = useLookup();

  const context = React.useMemo(() => {
    const I = props.for;

    if(!I)
      throw Oops.NoType();

    const layer = from.push();

    function register(I: Model | typeof Model){
      if(I instanceof Model)
        layer.inject(I.constructor as any, I, false);
      else
        layer.inject(I, I.create(), true);
    }

    if(I instanceof Model || typeof I == "function")
      register(I);
    else
      values(I).forEach(register);

    for(const instance of layer.local)
      if(instance)
        for(const apply of getPending(instance))
          apply(layer)

    return layer;
  }, []);

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

function useAppliedProps(within: Lookup, props: {}){
  const update = React.useMemo(() => {
    const targets = within.local;

    return function integrate(props: {}){
      for(const [key, value] of entries(props))
        if(!["of", "for", "children"].includes(key))
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
      return ensure(targets[0]).subscribe(() => refresh);

    return {} as Subscriber;
  });

  if(hook.commit)
    React.useLayoutEffect(hook.commit, []);

  return props.render(hook.proxy);
}