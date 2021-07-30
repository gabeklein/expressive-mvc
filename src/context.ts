import { createContext, createElement, ReactElement, ReactNode, useContext, useLayoutEffect, useMemo } from 'react';

import { useWatcher } from './hooks';
import { issues } from './issues';
import { Model } from './model';
import { Collection, Lookup } from './register';
import { keys, values } from './util';

export const Oops = issues({
  NoProviderType: () =>
    `Provider 'of' prop must be Model, typeof Model or a collection of them.`,

  NothingInContext: (name) =>
    `Couldn't find ${name} in context; did you forget to use a Provider?`,

  BadConsumerProps: () =>
    `Provider expects either a render function, 'get' or 'has' props.`
})

export const LookupContext = createContext(new Lookup());
export const useLookup = () => useContext(LookupContext);

export function useFromContext(T: typeof Model, strict?: boolean){
  const instance = useLookup().get(T);

  if(!instance && strict)
    throw Oops.NothingInContext(T.name);

  return instance;
}

interface ConsumerProps {
  of: typeof Model;
  get?: (value: Model) => void;
  has?: (value: Model) => void;
  children?: (value: Model) => ReactElement<any, any> | null;
}

export function Consumer(props: ConsumerProps){
  const { get, has, children, of: Control } = props;

  if(typeof children == "function")
    return children(Control.tap());

  const callback = has || get;

  if(typeof callback == "function")
    callback(Control.get(!!has));
  else
    throw Oops.BadConsumerProps()

  return null;
}

const Provided = new WeakMap<Lookup, Model>();

function useNewContext(
  adds?: typeof Model | Model | Collection){

  const stack = useLookup();

  return useMemo(() => {
    if(!adds)
      throw Oops.NoProviderType();

    const next = stack.push();

    if(adds instanceof Model || typeof adds == "function")
      Provided.set(next, next.register(adds));
    else
      values(adds).forEach(I => next.register(I));
        
    return next;
  }, []);
}

function useImportProps(within: Model, props: {}){
  function select(){
    return keys(within).filter(k => k != "of" && k != "children")
  }

  within.import(props, useMemo(select, []));
}

interface ProvideProps {
  of?: typeof Model | Model | Collection;
  children: ReactNode | ((instance: any) => ReactNode);
}

export function Provider(props: ProvideProps){
  let { children } = props;
  const value = useNewContext(props.of);
  const instance = Provided.get(value);

  if(instance)
    useImportProps(instance, props);

  if(typeof children == "function")
    children = children(instance && useWatcher(instance));

  useLayoutEffect(() => () => value.pop(), []);

  return createElement(LookupContext.Provider, { value }, children);
}