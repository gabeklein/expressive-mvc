import React, { Suspense } from 'react';

import { Parent } from '../children';
import { control } from '../control';
import { issues } from '../helper/issues';
import { assignWeak, entries } from '../helper/object';
import { Class } from '../helper/types';
import { Model } from './mvc';
import { getPending } from './get';
import { LookupContext, useLookup } from './useContext';

export const Oops = issues({
  NoType: () =>
    "Provider 'for' prop must be Model, typeof Model or a collection of them."
})

declare namespace Provider {
  type Item = Model | Model.New;

  type Multiple<T extends Item = Item> = T[] | { [key: string]: T };

  type Instance<E> = E extends Class ? InstanceType<E> : E extends Model ? E : never;

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

  type Props<T extends Item> = MultipleProps<T> | NormalProps<T>;
}

function Provider<T extends Provider.Item>(props: Provider.Props<T>){
  const context = useNewContext(props.for, props.use);

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

  const init = new Set<Model>();
  const ambient = useLookup();
  const context = React.useMemo(() => {
    if(!include)
      throw Oops.NoType();

    return ambient.push();
  }, []);

  function register(key: string | number, input: Model | Model.New){
    let instance: Model;

    if(context.register.get(key) === input)
      instance = typeof input == "object"
        ? input
        : context.get(input)!;
    else
      instance = context.add(input, key);

    init.add(instance);

    if(assign)
      assignWeak(instance, assign);
  }

  if(typeof include == "function" || include instanceof Model)
    register(0, include);
  else
    entries(include).forEach(e => register(...e));

  for(const instance of init){
    control(instance).state.forEach(value => {
      // TODO: should this run repeatedly?
      if(Parent.get(value) === instance){
        context.add(value);
        init.add(value);
      }
    });

    for(const apply of getPending(instance))
      apply(context)

    // TODO: add test to validate this.
    init.delete(instance);
  }

  React.useLayoutEffect(() => () => context.pop(), []);

  return context;
}