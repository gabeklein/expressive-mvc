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

export function useLookup(){
  return useContext(LookupContext);
}

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

function useProviderWith(
  instance: Model,
  props: PropsWithChildren<{ of: Model | typeof Model }>){

  const { of: model, children } = props;

  const current = useContext(LookupContext);
  const [ watch, value ] = useMemo(() => {
    const stack = current.push(instance.get);
    const applicable = keys(instance).filter(unexpected);
    const scanProps = () => instance.import(props, applicable);

    return [scanProps, stack]
  }, [ model ]);

  watch();

  return createElement(Provide, { value, instance, children });
}

function ParentProvider(props: PropsWithChildren<{ of: typeof Model }>){
  return useProviderWith(props.of.new(), props);
}

function DirectProvider(props: PropsWithChildren<{ of: Model }>){
  return useProviderWith(props.of, props);
}

function MultiProvider(
  props: PropsWithChildren<{ of: Collection }>){

  const { children } = props;
  const current = useContext(LookupContext);
  const value = useMemo(() => current.push(props.of), []);

  useLayoutEffect(() => () => value.pop(), []);

  return createElement(Provide, { value, children });
}

interface ProvideProps {
  value: Lookup;
  instance?: Model;
  children: ReactNode | ((instance: any) => ReactNode);
}

function Provide(props: ProvideProps){
  let { value, instance, children } = props;

  if(typeof children == "function")
    children = children(instance && useWatcher(instance));

  return createElement(LookupContext.Provider, { value }, children);
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