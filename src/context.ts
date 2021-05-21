import {
  createContext,
  createElement,
  PropsWithChildren,
  ReactElement,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
} from 'react';

import { Controller, Model } from './controller';
import { create, define, fn, values } from './util';

import Oops from './issues';

export class Context {
  static Single = createContext(new Context());

  static useAmbient(){
    return useContext(this.Single);
  }

  private table = new Map<Model, symbol>();

  private key(T: Model){
    let key = this.table.get(T);

    if(!key){
      key = Symbol(T.name);
      this.table.set(T, key);
    }

    return key;
  }

  public get(T: Model, strict?: boolean): Controller | undefined {
    const instance = (this as any)[this.key(T)];

    if(!instance && strict)
      throw Oops.NothingInContext(T.name);

    return instance;
  }
  
  public push(...items: Controller[]){
    const next = create(this) as Context;

    for(const I of items){
      let T = I.constructor as Model;
  
      do {
        define(next, this.key(T), I);
      }
      while(T = T.inherits!);
    }

    return next;
  }

  public pop(){
    for(const c of values<Controller>(this as any))
      c.destroy();
  }

  public provider(children: ReactNode){
    return createElement(Context.Single.Provider, { value: this }, children);
  }
}

interface ConsumerProps {
  of: Model;
  get?: (value: Controller) => void;
  has?: (value: Controller) => void;
  children?: (value: Controller) => ReactElement<any, any> | null;
}

export const Consumer = (props: ConsumerProps) => {
  const { get, has, children: render, of: Control } = props;

  if(fn(render))
    return render(Control.tap());

  const callback = has || get;

  if(fn(callback))
    callback(Control.get(!!has));

  return null;
}

interface ProviderProps {
  of: Controller | Model | Array<Model> | BunchOf<Model>,
  children?: ReactNode 
}

export function Provider(props: ProviderProps){
  const { of: target, children, ...data } = props;
 
  if(Controller.isTypeof(target))
    return createElement(ParentProvider, { target, data }, children);
  else if(target instanceof Controller)
    return createElement(DirectProvider, { target, data }, children);
  else if(typeof target == "object")
    return createElement(MultiProvider, { types: target }, children);
  else
    throw Oops.BadProviderProps();
}

function ParentProvider(
  props: PropsWithChildren<{ target: Model, data: {} }>){

  const instance = props.target.using(props.data);
  const current = Context.useAmbient();
  const layer = useMemo(() => current.push(instance.get), [props.target]);

  return layer.provider(props.children); 
}

function DirectProvider(
  props: PropsWithChildren<{ target: Controller, data: {} }>){

  props.target.update(props.data);

  const current = Context.useAmbient();
  const layer = useMemo(() => current.push(props.target), [props.target]);

  return layer.provider(props.children); 
}

function MultiProvider(
  props: PropsWithChildren<{ types: Array<Model> | BunchOf<Model> }>){

  const current = Context.useAmbient();
  const layer = useMemo(() => current.push(
    ...values(props.types).map(T => T.create())
  ), []);

  useEffect(() => () => layer.pop(), []);

  return layer.provider(props.children); 
}