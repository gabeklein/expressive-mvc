import {
  createContext,
  createElement,
  ReactElement,
  ReactNode,
  useContext,
  useLayoutEffect,
  useMemo,
} from 'react';

import { useWatcher } from './hooks';
import { issues } from './issues';
import { Model } from './model';
import { Collection, Lookup } from './register';
import { keys } from './util';

export const Oops = issues({
  NothingInContext: (name) =>
    `Couldn't find ${name} in context; did you forget to use a Provider?`,

  NoProviderType: () =>
    `Provider 'of' prop must be Model, typeof Model or a collection of them.`,

  BadConsumerProps: () =>
    `Provider expects either a render function, 'get' or 'has' props.`
})

const LookupContext = createContext(new Lookup());

export const useLookup = () => useContext(LookupContext);

export function useFromContext(
  T: typeof Model, strict?: boolean){

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
  const { get, has, children: render, of: Control } = props;

  if(typeof render == "function")
    return render(Control.tap());

  const callback = has || get;

  if(typeof callback == "function")
    callback(Control.get(!!has));
  else
    throw Oops.BadConsumerProps()

  return null;
}

const notExpected = (key: string) => key != "of" && key != "children";

interface ProvideProps {
  of?: typeof Model | Model | Collection;
  children: ReactNode | ((instance: any) => ReactNode);
}

export function Provider(props: ProvideProps){
  let { of: type, children } = props;

  const stack = useContext(LookupContext);
  const value = useMemo(() => {
    if(!type)
      throw Oops.NoProviderType();

    return stack.push(type);
  }, []);
  const target = value.default;

  if(typeof children == "function")
    children = children(target && useWatcher(target));

  if(target)
    target.import(props,
      useMemo(() => keys(target).filter(notExpected), [])
    );

  useLayoutEffect(() => () => value.pop(), []);

  return createElement(LookupContext.Provider, { value }, children);
}