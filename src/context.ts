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

  static createLayer(
    insert: Controller | Array<Model> | BunchOf<Model>,
    dependancy?: any){

    const current = this.useAmbient();

    return useMemo(() => {
      const provide =
        insert instanceof Controller ? [ insert ] :
        values(insert).map(T => T.create());

      return current.push(provide);
    }, [ dependancy ])
  }

  public createProvider(children: ReactNode){
    return createElement(
      Context.Single.Provider, { value: this }, children
    );
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
  
  public push(items: Controller | Controller[]){
    const next = create(this) as Context;

    items = ([] as Controller[]).concat(items);

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

  let { children, target, data } = props;
  const instance = target.using(data);

  if(fn(children))
    children = children(instance);

  return Context
    .createLayer(instance.get, target)
    .createProvider(children); 
}

function DirectProvider(
  props: PropsWithChildren<{ target: Controller, data: {} }>){

  const { target, data, children } = props;

  target.update(data);

  return Context
    .createLayer(target, target)
    .createProvider(children);
}

function MultiProvider(
  props: PropsWithChildren<{ types: Array<Model> | BunchOf<Model> }>){

  const layer = Context.createLayer(props.types);

  useEffect(() => () => layer.pop(), []);

  return layer.createProvider(props.children); 
}