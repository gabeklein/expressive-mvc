import Model, { Context } from '@expressive/mvc';
import {
  createContext,
  createElement,
  ReactNode,
  Suspense,
  useContext,
  useEffect,
  useMemo
} from 'react';

const Lookup = createContext(new Context());

declare module '@expressive/mvc' {
  namespace Context {
    function use(create?: true): Context;
    function use(create: boolean): Context | null | undefined;
  }
}

Context.use = (create?: boolean) => {
  const ambient = useContext(Lookup);

  return create ? useMemo(() => ambient.push(), [ambient]) : ambient;
};

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
  };
}

function Consumer<T extends Model>(props: Consumer.Props<T>) {
  return props.for.get((i) => props.children(i));
}

declare namespace Provider {
  interface Props<T extends Model> {
    /** Model or group of Models to provide to descendant Consumers. */
    for: Context.Accept<T>;

    forEach?: Context.Expect<T>;
    children?: ReactNode;

    /** A fallback react tree to show when suspended. */
    fallback?: ReactNode;

    /**
     * A name for this Suspense boundary for instrumentation purposes.
     * The name will help identify this boundary in React DevTools.
     */
    name?: string | undefined;
  }
}

function Provider<T extends Model>(props: Provider.Props<T>) {
  const context = Context.use(true);

  useEffect(() => () => context.pop(), [context]);

  context.include(props.for, (model) => {
    if (props.forEach) {
      const cleanup = props.forEach(model);

      if (cleanup) model.set(cleanup, null);
    }
  });

  return createProvider(context, props.children, props.fallback, props.name);
}

export function createProvider(
  context: Context | Model,
  children: ReactNode,
  fallback?: ReactNode,
  name?: string | undefined
) {
  if (context instanceof Model) context = Context.get(context)!;

  const element = createElement(Lookup.Provider, {
    key: context.id,
    value: context,
    children
  });

  return fallback !== undefined
    ? createElement(Suspense, { fallback, name }, element)
    : element;
}

export { Consumer, Provider };
