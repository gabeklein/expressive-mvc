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
import { fn, keys } from './util';

export const Oops = issues({
  NothingInContext: (name) =>
    `Couldn't find ${name} in context; did you forget to use a Provider?`,

  BadProviderType: () =>
    `Provider 'of' prop must be Model, typeof Model or a collection of them.`,

  BadConsumerProps: () =>
    `Provider expects either a render function, 'get' or 'has' props.`
})

const LookupContext = createContext(new Lookup());
const LookupProvider = LookupContext.Provider;

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

  if(fn(render))
    return render(Control.tap());

  const callback = has || get;

  if(fn(callback))
    callback(Control.get(!!has));
  else
    throw Oops.BadConsumerProps()

  return null;
}

interface RenderProviderProps {
  instance: Model;
  render: Function
}

function RenderProvider(props: RenderProviderProps){
  return props.render(useWatcher(props.instance));
}

function useProviderWith(
  instance: Model,
  props: PropsWithChildren<{ of: Model | typeof Model }>){

  const current = useContext(LookupContext);
  const [ watch, next ] = useMemo(() => [
    keys(instance).filter(k => k != "of" && k != "children"),
    current.push(instance.get)
  ], [ props.of ]);

  instance.import(props as any, watch);

  let render = props.children;

  if(fn(render))
    render = createElement(RenderProvider, { instance, render });

  return createElement(LookupProvider, { value: next }, render);
}

function ParentProvider(props: PropsWithChildren<{ of: typeof Model }>){
  return useProviderWith(props.of.new(), props);
}

function DirectProvider(props: PropsWithChildren<{ of: Model }>){
  return useProviderWith(props.of, props);
}

function MultiProvider(
  props: PropsWithChildren<{ of: Collection }>){

  const current = useContext(LookupContext);
  const value = useMemo(() => current.push(props.of), []);

  useLayoutEffect(() => () => value.pop(), []);

  return createElement(LookupProvider, { value }, props.children);
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