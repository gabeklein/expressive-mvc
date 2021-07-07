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
import { create, defineProperty, fn, getOwnPropertyDescriptor, getOwnPropertySymbols, keys, values } from './util';

export const Oops = issues({
  NothingInContext: (name) =>
    `Couldn't find ${name} in context; did you forget to use a Provider?`,

  BadProviderType: () =>
    `Provider 'of' prop must be Model, typeof Model or a collection of them.`,

  BadConsumerProps: () =>
    `Provider expects either a render function, 'get' or 'has' props.`
})

export class Lookup {
  private table = new Map<typeof Model, symbol>();

  private key(T: typeof Model){
    let key = this.table.get(T);

    if(!key){
      key = Symbol(T.name);
      this.table.set(T, key);
    }

    return key;
  }

  public get(T: typeof Model, strict?: boolean){
    const instance = (this as any)[this.key(T)];

    if(!instance && strict)
      throw Oops.NothingInContext(T.name);

    return instance as Model | undefined;
  }
  
  public push(items: Model | ProvideCollection){
    const next = create(this) as Lookup;

    items = items instanceof Model
      ? [ items ] : values(items);

    for(let I of items)
      next.register(I);

    return next;
  }

  public register(I: Model | typeof Model){
    let writable = true;
    let T: typeof Model;

    if(I instanceof Model){
      T = I.constructor as any;
      writable = false;
    }
    else {
      T = I;
      I = I.create();
    }

    do {
      defineProperty(this, this.key(T), {
        value: I,
        writable
      });
    }
    while(T = T.inherits!);
  }

  public pop(){
    for(const key of getOwnPropertySymbols(this)){
      const { writable, value: instance } =
        getOwnPropertyDescriptor(this, key)!;

      if(writable)
        instance.destroy();
    }
  }
}

type ProvideCollection =
  | Array<Model | typeof Model>
  | BunchOf<Model | typeof Model>;

const LookupContext = createContext(new Lookup());
const LookupProvider = LookupContext.Provider;

export function useLookup(){
  return useContext(LookupContext);
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

function useProviderWith(
  instance: Model,
  props: PropsWithChildren<{ of: Model | typeof Model }>){

  const current = useContext(LookupContext);
  const { watch, next } = useMemo(() => ({
    watch: keys(instance).filter(k => k != "of" && k != "children"),
    next: current.push(instance.get)
  }), [ props.of ]);

  instance.import(props as any, watch);

  let render = props.children;

  if(fn(render))
    render = createElement(RenderProvider, { instance, render });

  return createElement(LookupProvider, { value: next }, render);
}

interface RenderProviderProps {
  instance: Model;
  render: Function
}

function RenderProvider(props: RenderProviderProps){
  return props.render(useWatcher(props.instance));
}

function ParentProvider(props: PropsWithChildren<{ of: typeof Model }>){
  const instance = props.of.new();

  return useProviderWith(instance, props);
}

function DirectProvider(props: PropsWithChildren<{ of: Model }>){
  return useProviderWith(props.of, props);
}

function MultiProvider(
  props: PropsWithChildren<{ of: ProvideCollection }>){

  const current = useContext(LookupContext);
  const value = useMemo(() => current.push(props.of), []);

  useLayoutEffect(() => () => value.pop(), []);

  return createElement(LookupProvider, { value }, props.children);
}

interface ProviderProps {
  of: Model | typeof Model | ProvideCollection;
  children?: ReactNode;
}

export function Provider(props: ProviderProps){
  const Type: any = useMemo(() => {
    const { of: target } = props;

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