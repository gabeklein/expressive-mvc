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
import { assign, create, defineProperty, fn, getOwnPropertyDescriptor, getOwnPropertySymbols, values } from './util';

export const Oops = issues({
  NothingInContext: (name) =>
    `Couldn't find ${name} in context; did you forget to use a Provider?`,

  BadProviderProps: () =>
    `Provider expects either 'of' or 'for' props.`,

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

function useIncluding(
  insert: Model | ProvideCollection,
  dependancy?: any){

  const current = useContext(LookupContext);
  const next = () => current.push(insert);

  return useMemo(next, [ dependancy ])
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

interface ProviderProps {
  of: Model | typeof Model | ProvideCollection;
  children?: ReactNode;
}

export function Provider(props: ProviderProps){
  const { children, of: target } = props;
  const data = assign({}, props, { children: null, of: null });
 
  if(Model.isTypeof(target))
    return createElement(ParentProvider, { target, data }, children);
  else if(target instanceof Model)
    return createElement(DirectProvider, { target, data }, children);
  else if(typeof target == "object")
    return createElement(MultiProvider, { types: target }, children);
  else
    throw Oops.BadProviderProps();
}

function ParentProvider(
  props: PropsWithChildren<{ target: typeof Model, data: {} }>){

  let { children, target, data } = props;
  const instance = target.using(data);
  const value = useIncluding(instance.get, target);

  if(fn(children))
    children = children(instance);

  return createElement(LookupProvider, { value }, children);
}

function DirectProvider(
  props: PropsWithChildren<{ target: Model, data: {} }>){

  const { children, data, target } = props;
  const value = useIncluding(target, target);

  target.import(data);

  return createElement(LookupProvider, { value }, children);
}

function MultiProvider(
  props: PropsWithChildren<{ types: ProvideCollection }>){

  const { children, types } = props;
  const value = useIncluding(types);

  useLayoutEffect(() => () => value.pop(), []);

  return createElement(LookupProvider, { value }, children);
}