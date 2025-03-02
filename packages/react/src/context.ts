import Model, { Context } from '@expressive/mvc';
import { ReactNode, createContext, createElement, useContext, useEffect, useMemo } from 'react';

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
  interface SetProps<T extends Model> {
    for: Context.Accept<T>;
    /** @deprecated May be removed in future versions. Use component Models instead. */
    set?: Model.Assign<T>;
    children?: ReactNode;
  }

  interface NewProps<T extends Model> {
    for: Context.Accept<T>;
    forEach?: Context.Expect;
    children?: ReactNode;
  }

  type Props<T extends Model> = SetProps<T> | NewProps<T>;
}

function Provider<T extends Model>(props: Provider.Props<T>){
  const ambient = useContext(Lookup);
  const context = useMemo(() => ambient.push(), [ambient]);

  useEffect(() => () => context.pop(), [ambient]);
  
  // TODO: Replace with Context.ForEach instead.
  context.include(props.for, (model) => {
    if("forEach" in props && props.forEach){
      const cleanup = props.forEach(model);

      if(cleanup)
        model.get(null, cleanup);
    }
    else if("set" in props && props.set)
      for(const key in props.set)
        if(key in model)
          (model as any)[key] = props.set[key];
  });

  return createElement(Lookup.Provider, {
    key: context.id,
    value: context
  }, props.children);
}

export { Consumer, Provider, Lookup as Context }