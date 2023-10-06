import { Context, Model } from '@expressive/mvc';
import { Component, createElement, useContext, useEffect, useMemo } from 'react';

import { Shared, setContext } from './useLocal';

import type { FunctionComponentElement, ProviderProps, ReactNode } from 'react';

declare namespace Provider {
  type Element = FunctionComponentElement<ProviderProps<Context>>;

  type Item = Model | Model.New;

  type Multiple<T extends Item = Item> = { [key: string | number]: T };

  type Instance<E> = E extends (new () => any) ? InstanceType<E> : E extends Model ? E : never;

  type Props<T extends Item = Item> = MultipleProps<T> | NormalProps<T>;

  type NormalProps<E, I = Instance<E>> = {
    for: E;
    //TODO: use a more strict type for this
    children?: unknown;
    use?: Model.Values<I>;
  }

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> = {
    for: Multiple<T>;
    //TODO: use a more strict type for this
    children?: unknown;
    use?: Model.Values<Instance<T>>;
  }
}

function Provider<T extends Provider.Item>(
  props: Provider.Props<T>): Provider.Element {

  let { for: included, use: assign, children } = props;

  const context = useContext(Shared)
  const value = useMemo(() => context.push(), []);

  if(!included)
    reject(included);

  if(typeof included == "function" || included instanceof Model)
    included = { [0]: included };

  Object.entries(included).forEach(([K, V]) => {
    if(!(Model.is(V) || V instanceof Model))
      reject(`${V} as ${K}`);
  })
  
  value.include(included).forEach((isExplicit, model) => {
    model.set(PROVIDE);

    if(assign && isExplicit)
      for(const K in assign)
        if(K in model)
          (model as any)[K] = (assign as any)[K];

    setContext(model, value);
  });

  useEffect(() => () => value.pop(), []);

  return createElement(Shared.Provider, { value, key: value.key }, children as ReactNode);
}

function reject(argument: any){
  throw new Error(`Provider expects a Model instance or class but got ${argument}.`);
}

const PROVIDE = Symbol("Provider");

declare module '@expressive/mvc' {
  // Prevent Models from implementing a render method.
  class Model {
    /** @internal Impersonates a React.Component to instead spawn a Provider.  */
    readonly render: never;
  }
}

declare module 'react' {
  // TODO: Seek a more elegant solution. This is a hack.
  // This will force JSX.ElementType (defined by react) to accept a Model.
  // We do this by overriding the Component interface, making what are
  // required properties optional instead. This makes Model constructor
  // a valid (enough) React.ComponentType.
  interface Component<P, S> {
    // @ts-expect-error
    context?: unknown;

    // @ts-expect-error
    setState?<K extends keyof S>(
      state: ((prevState: Readonly<S>, props: Readonly<P>) => (Pick<S, K> | S | null)) | (Pick<S, K> | S | null),
      callback?: () => void
    ): void;

    // @ts-expect-error
    forceUpdate?(callback?: () => void): void;

    // @ts-expect-error
    readonly props?: Readonly<P>;

    // @ts-expect-error
    state?: {};

    // @ts-expect-error
    refs?: {
      [key: string]: React.ReactInstance
    };
  }
}

// This will trick react into thinking Model is a component.
Object.setPrototypeOf(Model.prototype, Component.prototype);

// Block methods/getters which are inherited otherwise.
for(const key in Component.prototype)
  if(key !== "constructor"){
    Object.defineProperty(Model.prototype, key, {
      ...Object.getOwnPropertyDescriptor(Component.prototype, key),
      enumerable: false
    });
  }

// With React thinking Model is a component, implement render method.
Object.defineProperties(Model.prototype, {
  isMounted: {
    value: undefined,
    enumerable: false
  },
  replaceState: {
    value: undefined,
    enumerable: false
  },
  isPureReactComponent: {
    value: true,
    enumerable: false
  },
  render: {
    value(this: any){
      const { props } = this;

      delete this.props;
      delete this.refs;
      delete this.state;
      delete this.updater;
      delete this.context;
      delete this._reactInternalInstance;
      delete this._reactInternals;

      return createElement(Provider, { for: this, ...props });
    }
  }
})

export { Provider };