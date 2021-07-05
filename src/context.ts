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

import { issues } from './issues';
import { Model } from './model';
import { create, defineProperty, keys, fn, getOwnPropertyDescriptor, getOwnPropertySymbols, values } from './util';

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

    for(let I of items){
      let managed = true;
      let T: typeof Model;

      if(I instanceof Model){
        managed = false;
        T = I.constructor as typeof Model;
      }
      else {
        T = I;
        I = I.create();
      }

      do {
        defineProperty(next, this.key(T), {
          value: I,
          writable: managed
        });
      }
      while(T = T.inherits!);
    }

    return next;
  }

  public pop(){
    for(const key of getOwnPropertySymbols(this)){
      const desc = getOwnPropertyDescriptor(this, key)!;

      if(desc.writable)
        desc.value!.destroy();
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
  layer: Model | ProvideCollection,
  children?: ReactNode,
  dependancy?: any){

  const current = useContext(LookupContext);
  const value = useMemo(() => current.push(layer), [ dependancy ]);

  if(!dependancy)
    useLayoutEffect(() => () => value.pop(), []);

  return createElement(LookupProvider, { value }, children);
}

function importFrom(props: any, to: Model){
  const transferable = useMemo(() =>
    keys(to).filter(k => k != "of" && k != "children"), [ to ]
  );

  to.import(props, transferable);
}

function ParentProvider(
  props: PropsWithChildren<{ of: typeof Model }>){

  let { children, of: target } = props;
  const instance = target.use();

  importFrom(props, instance);

  if(fn(children))
    children = children(instance);

  return useProviderWith(instance.get, children, target);
}

function DirectProvider(
  props: PropsWithChildren<{ of: Model }>){

  const { of: instance, children } = props;

  importFrom(props, instance);

  return useProviderWith(instance, children, instance);
}

function MultiProvider(
  props: PropsWithChildren<{ of: ProvideCollection }>){

  return useProviderWith(props.of, props.children);
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