import Model, { Context } from '@expressive/mvc';
import { ComponentChildren, createContext, createElement } from 'preact';
import { useContext, useEffect, useMemo } from 'preact/hooks';

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
    children: (value: T) => ComponentChildren | void;
  }
}

function Consumer<T extends Model>(props: Consumer.Props<T>){
  return props.for.get(i => props.children(i));
}

declare namespace Provider {
  interface Props<T extends Model> {
    for: Context.Accept<T>;
    forEach?: Context.Expect<T>;
    children?: ComponentChildren;
  }
}

function Provider<T extends Model>(props: Provider.Props<T>){
  const ambient = useContext(Lookup);
  const context = useMemo(() => ambient.push(), [ambient]);

  useEffect(() => () => context.pop(), [context]);
  
  context.include(props.for, (model) => {
    if(props.forEach){
      const cleanup = props.forEach(model);

      if(cleanup)
        model.set(null, cleanup);
    }
  });

  return createElement(Lookup.Provider, {
    key: context.id,
    value: context
  }, props.children);
}

export { Consumer, Provider, Lookup }