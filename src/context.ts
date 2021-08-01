import { createContext, createElement, ReactElement, ReactNode, useContext, useLayoutEffect, useMemo } from 'react';

import { use } from './hooks';
import { issues } from './issues';
import { Model } from './model';
import { Collection, Lookup } from './register';
import { Subscriber } from './subscriber';
import { entries, getOwnPropertySymbols, values } from './util';

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

export function useFromContext(
  Type: typeof Model, strict?: boolean){

  const instance = useLookup().get(Type);

  if(!instance && strict)
    throw Oops.NothingInContext(Type.name);

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

function useAppliedProps(
  within: Lookup, props: {}){

  const update = useMemo(() => {
    const targets = getOwnPropertySymbols(within).map(
      (symbol): Model => (within as any)[symbol]
    );

    return function integrate(props: {}){
      for(const [key, value] of entries(props))
        if(key != "of" && key != "children")
          for(const into of targets)
            if(key in into)
              (into as any)[key] = value;
    };
  }, []);

  update(props);
}

interface RenderProps {
  value: Lookup;
  render: (instance?: any) => ReactNode;
}

function RenderProvider(props: RenderProps): any {
  const hook = use(refresh => {
    const target = Provided.get(props.value);

    return target
      ? new Subscriber(target, refresh)
      : {} as Subscriber;
  });

  if(hook.commit)
    useLayoutEffect(() => hook.commit(), []);

  return props.render(hook.proxy);
};

interface ProvideProps {
  of?: typeof Model | Model | Collection;
  children: ReactNode | ((instance: any) => ReactNode);
}

export function Provider(props: ProvideProps){
  const render: any = props.children;
  const value = useNewContext(props.of);

  useAppliedProps(value, props);
  useLayoutEffect(() => () => value.pop(), []);

  return createElement(LookupContext.Provider, { value },
    typeof render == "function"
      ? createElement(RenderProvider, { value, render })
      : render
  );
}