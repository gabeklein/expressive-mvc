import { createContext, createElement, ReactElement, ReactNode, useContext, useLayoutEffect, useMemo } from 'react';

import { use } from './hooks';
import { issues } from './issues';
import { Model } from './model';
import { applyParallel } from './peer';
import { Collection, Lookup } from './register';
import { Subscriber } from './subscriber';
import { entries } from './util';

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

function useAppliedProps(
  within: Lookup, props: {}){

  const update = useMemo(() => {
    const targets = within.local;

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

interface RenderFunctionProps {
  context: Lookup;
  render: (instance?: any) => ReactNode;
}

function RenderFunction(props: RenderFunctionProps): any {
  const hook = use(refresh => {
    const targets = props.context.local;

    if(targets.length == 1)
      return new Subscriber(targets[0], refresh);

    return {} as Subscriber;
  });

  if(hook.commit)
    useLayoutEffect(() => hook.commit(), []);

  return props.render(hook.proxy);
}

interface ProvideProps {
  of?: typeof Model | Model | Collection;
  children: ReactNode | ((instance: any) => ReactNode);
}

export function Provider(props: ProvideProps){
  const render: any = props.children;
  const current = useLookup();
  const context = useMemo(() => {
    if(!props.of)
      throw Oops.NoProviderType();
    
    const context = current.push(props.of);

    applyParallel(context);

    return context;
  }, []);

  useAppliedProps(context, props);
  useLayoutEffect(() => () => context.pop(), []);

  return createElement(LookupContext.Provider, { value: context },
    typeof render == "function"
      ? createElement(RenderFunction, { context, render })
      : render
  );
}