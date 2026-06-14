import { State, Context, Component } from '@expressive/mvc';
import { Runtime, useHook } from './runtime';

let shared: any;

/**
 * Lazily-created context carrying the active {@link Context} down the tree.
 * Lazy because the framework's `createContext` arrives via {@link Runtime},
 * which an adapter's entry populates at load - after this module evaluates.
 */
function Layers() {
  return shared || (shared = Runtime.createContext(Context.root));
}

const _get = Context.get;

Context.get = (state?: State) => {
  if (!state)
    try {
      return Runtime.useContext(Layers());
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
    children: (value: T) => Component.Node | void;
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
    children?: Component.Node;

    /** A fallback tree to show when suspended. */
    fallback?: Component.Node;

    /**
     * A name for this Suspense boundary for instrumentation purposes.
     * The name will help identify this boundary in React DevTools.
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

  const ambient = Runtime.useContext(Layers());
  const context = useHook<Context>((set) => {
    set(new Context(ambient));
    return () => context.pop();
  });

  context.set(input, is);

  if (Object.keys(rest).length) {
    const i = State.is(input) ? context.get(input) : input;
    if (i instanceof State) i.set(rest);
  }

  return Runtime.createElement(Layers().Provider, {
    value: context,
    children:
      fallback !== undefined
        ? Runtime.createElement(Runtime.Suspense, { fallback, name }, children)
        : children
  });
}

export { Consumer, Provider, Context, Layers };
