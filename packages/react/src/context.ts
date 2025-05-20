import Model, { Context } from '@expressive/mvc';
import React, { ReactNode } from 'react';

const Lookup = React.createContext(new Context());

function useContext(create?: boolean){
  const ambient = React.useContext(Lookup);

  return create ?
    React.useMemo(() => ambient.push(), []) :
    ambient;
}

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
    forEach?: Context.Expect<T>;
    children?: ReactNode;
  }
}

function Provider<T extends Model>(props: Provider.Props<T>){
  const context = useContext(true);

  React.useEffect(() => () => context.pop(), [context]);

  context.include(props.for, (model) => {
    if(props.forEach){
      const cleanup = props.forEach(model);

      if(cleanup)
        model.set(null, cleanup);
    }
  });

  return React.createElement(Lookup.Provider, {
    key: context.id,
    value: context
  }, props.children);
}

export { Consumer, Provider, Lookup, Context, useContext }
