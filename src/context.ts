import {
  createContext,
  createElement,
  PropsWithChildren,
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

  BadProviderType: () =>
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

const unexpected = (key: string) => key != "of" && key != "children";

function useImportedProps(instance: any, props: any){
  useMemo(() => {
    const select = keys(instance).filter(unexpected);
    return () => instance.import(props, select);
  }, [instance])();
}

interface ProvideProps {
  instance?: Model;
  inject?: Collection;
  children: ReactNode | ((instance: any) => ReactNode);
}

function Provide(props: ProvideProps){
  let { instance, inject, children } = props;

  const stack = useContext(LookupContext);
  const value = useMemo(() => stack.push(instance || inject!), [instance]);

  if(typeof children == "function")
    children = children(
      instance ? useWatcher(instance) : inject
    )

  useLayoutEffect(() => () => value.pop(), []);

  return createElement(LookupContext.Provider, { value }, children);
}

function ParentProvider(props: PropsWithChildren<{ of: typeof Model }>){
  const { children } = props;
  const instance = props.of.new();

  useImportedProps(instance, props);
  
  return createElement(Provide, { instance, children });
}

function DirectProvider(props: PropsWithChildren<{ of: Model }>){
  const { of: instance, children } = props;

  useImportedProps(instance, props);

  return createElement(Provide, { instance, children });
}

function MultiProvider(props: PropsWithChildren<{ of: Collection }>){
  const { of: inject, children } = props;

  return createElement(Provide, { inject, children });
}

interface ProviderProps {
  of: Model | typeof Model | Collection;
  children?: ReactNode;
}

export function Provider(props: ProviderProps){
  const Type: any = useMemo(() => {
    const target = props.of;

    if(Model.isTypeof(target))
      return ParentProvider;

     if(target instanceof Model)
      return DirectProvider;

     if(typeof target == "object")
      return MultiProvider;

    throw Oops.BadProviderType();
  }, []);

  return createElement(Type, props);
}