import { createContext, createElement, CSSProperties, ReactNode, useContext, useEffect, useMemo } from 'react';

import type { Controller } from './controller';
import { define, entriesIn, Issues } from './util';

const Oops = Issues({
  ContextNotFound: (name) =>
    `Can't subscribe to controller; this accessor can` +
    `only be used within a Provider keyed for ${name}.`
});

export class Context 
  extends Map<typeof Controller, Controller> {

  constructor(
    private inherits?: Context,
    insert?: (readonly [typeof Controller, Controller])[]){
    super(insert);
  }

  get(key: typeof Controller): Controller | undefined {
    return super.get(key) || this.inherits && this.inherits.get(key);
  }
}

const CONTEXT_BASE = new Context();
const CONTEXT_CHAIN = createContext(CONTEXT_BASE);
const NEEDS_HOOK = new WeakMap<Controller, boolean>();

export function getFromContext(Type: typeof Controller){
  const instance = useContext(CONTEXT_CHAIN).get(Type);

  if(!instance)
    throw Oops.ContextNotFound(Type.name);

  return instance;
}

export function attachFromContext(instance: Controller){
  if(NEEDS_HOOK.has(instance)){
    if(NEEDS_HOOK.get(instance))
      useContext(CONTEXT_CHAIN);
    return;
  }

  const pending = entriesIn(instance).filter(
    entry => Controller.isTypeof(entry[1].value)
  )

  if(!pending.length){
    NEEDS_HOOK.set(instance, false);
    return;
  }
  
  const context = useContext(CONTEXT_CHAIN);

  for(const [key, { value }] of pending)
    define(instance, key, context.get(value));

  NEEDS_HOOK.set(instance, true);

  return () => NEEDS_HOOK.set(instance, false);
}

type ContainerProps = {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function ControlProvider(this: Controller){

  return (props: ContainerProps) => {
    let { children } = props;

    if(props.className || props.style)
      children = createElement("div", props);

    return createElement(InsertProvider, { for: this, children });
  }
}

type InsertProviderProps = {
  children?: ReactNode;
  for?: Controller;
  of?: (typeof Controller)[]
}

export function InsertProvider(props: InsertProviderProps){
  let {
    children,
    for: instance,
    of: inserts
  } = props;

  const parent = useContext(CONTEXT_CHAIN);
  const context = useMemo(
    () => new Context(parent, 
      instance && [instance.constructor as any, instance] ||
      inserts && inserts.map(T => [T, T.create()])  
    ), 
  []);

  if(inserts)
    useEffect(() => () => context.forEach(c => c.destroy()), []);

  return createElement(CONTEXT_CHAIN.Provider, { value: context, children });
}