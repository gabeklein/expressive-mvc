import Model, { Context } from '@expressive/mvc';
import React, { ReactNode, createContext, createElement, useContext, useEffect, useMemo, Children } from 'react';

const Lookup = createContext(new Context());

declare namespace Consumer {
  type Props<T extends Model> = {
    /** Type of controller to fetch from context. */
    for: Model.Type<T>;

    /**
     * Render function, will receive instance of desired controller.
     *
     * Called every render of parent component.
     * Similar to `Model.get()`, updates to properties accessed in
     * this function will cause a refresh when they change.
     */
    children: (value: T) => ReactNode | void;
  }
}

function Consumer<T extends Model>(props: Consumer.Props<T>){
  return props.for.get(i => props.children(i));
}

declare namespace Provider {
  interface Props<T extends Model> {
    for: Context.Accept<T>;
    set?: Model.Assign<T>;
    children?: ReactNode;
  }
}

function Provider<T extends Model>(props: Provider.Props<T>){
  const ambient = useContext(Lookup);
  const value = useMemo(() => ambient.push(), [ambient]);
  const inner = Children.map(props.children, (child: ReactNode | ((model: T) => ReactNode)) => {
    if(typeof child === 'function'){
      return child(value) || null;
    }
    return child;
  });

  useEffect(() => () => value.pop(), [ambient]);
  
  value.include(props.for, props.set);

  return createElement(Lookup.Provider, { key: value.id, value }, inner);
}

function functionToComponent<T extends Model>(fn: Consumer.Props<T>['children']){
}

export { Consumer, Provider, Lookup as Context }