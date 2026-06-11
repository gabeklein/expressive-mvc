import { State, Context } from '@expressive/mvc';
import { useHook } from '@expressive/react/state';

import { ComponentChildren } from 'preact';
import { createContext, createElement, Suspense } from 'preact/compat';
import { useContext } from 'preact/hooks';

const Layers = createContext(Context.root);

const _get = Context.get;

Context.get = (state?: State) => {
  if (!state)
    try {
      return useContext(Layers);
    } catch { }

  return _get(state);
};

declare namespace Consumer {
  type Props<T extends State> = {
    /** Type of controller to fetch from context. */
    for: State.Extends<T>;

    /**
     * Render function, will receive instance of desired controller.
     *
     * Called every render of parent component.
     * Similar to `State.get()`, updates to properties accessed in
     * this function will cause a refresh when they change.
     */
    children: (value: T) => ComponentChildren | void;
  };
}

function Consumer<T extends State>(props: Consumer.Props<T>) {
  return props.for.get((i) => props.children(i));
}

declare namespace Provider {
  type ForEach<T> = (state: T) => void | (() => void);

  interface SharedProps {
    /**
     * Children to render within this Provider.
     */
    children?: ComponentChildren;

    /** A fallback tree to show when suspended. */
    fallback?: ComponentChildren;

    /**
     * A name for this Suspense boundary for instrumentation purposes.
     * Accepted for parity with React; preact does not surface it.
     */
    name?: string | undefined;
  }

  type ForSingleProps<T extends State> = SharedProps & {
    for: T | State.Type<T>;
    is: (instance: T) => void;
  } & { [K in State.Field<T>]?: T[K] };

  type ForMultipleProps<T extends State> = SharedProps & {
    for: Context.Accept<T>;
    is?: ForEach<T>;
  };

  type Props<T extends State = State> = ForSingleProps<T> | ForMultipleProps<T>;
}

function Provider<T extends State>(props: Provider.Props<T>) {
  const {
    for: input,
    children,
    fallback,
    name,
    is,
    ...rest
  } = props as Provider.ForSingleProps<T> & Provider.ForMultipleProps<T>;

  const ambient = useContext(Layers);
  const context = useHook<Context>((set) => {
    set(new Context(ambient));
    return () => context.pop();
  });

  context.set(input, is);

  if (Object.keys(rest).length) {
    const i = State.is(input) ? context.get(input) : input;
    if (i instanceof State) i.set(rest);
  }

  return createElement(Layers.Provider, {
    value: context,
    children:
      fallback !== undefined
        ? createElement(Suspense as any, { fallback, name }, children)
        : children
  });
}

export { Consumer, Provider, Context, Layers };
