import React from 'react';

import { use, useTap } from './hooks';
import { issues } from './issues';
import { Model } from './model';
import { getPending } from './peer';
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

export const LookupContext = React.createContext(new Lookup());
export const useLookup = () => React.useContext(LookupContext);

export function useContext<T extends Class>(
  Type: T, strict?: boolean){

  const instance = useLookup().get(Type as any);

  if(!instance && strict)
    throw Oops.NothingInContext(Type.name);

  return instance as InstanceOf<T>;
}

interface ConsumerProps {
  of: typeof Model;
  get?: (value: Model) => void;
  has?: (value: Model) => void;
  children?: (value: Model) => React.ReactElement<any, any> | null;
}

export function Consumer(props: ConsumerProps){
  const { get, has, children, of: Control } = props;

  if(typeof children == "function")
    return children(useTap(useContext(Control)));

  const callback = has || get;

  if(typeof callback == "function")
    callback(useContext(Control, !!has));
  else
    throw Oops.BadConsumerProps()

  return null;
}

function useNewContext(
  inject?: Model | typeof Model | Collection){

  const from = useLookup();

  return React.useMemo(() => {
    if(!inject)
      throw Oops.NoProviderType();
    
    const context = from.push(inject);

    for(const instance of context.local)
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
            if(key in into)
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
    React.useLayoutEffect(() => hook.commit(), []);

  return props.render(hook.proxy);
}

interface ProvideProps {
  of?: typeof Model | Model | Collection;
  children: React.ReactNode | ((instance?: any) => React.ReactNode);
}

export function Provider(props: ProvideProps){
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