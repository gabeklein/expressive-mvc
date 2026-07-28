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

/** Read the ambient {@link Context} from the nearest Layers provider. */
function useAmbient() {
  return Runtime.useContext(Layers());
}

/** Wrap `children` in a {@link Layers} provider carrying `context` down the tree. */
function createProvider(context: Context, children: any) {
  return Runtime.createElement(Layers().Provider, { value: context, children });
}

// Class components consume the active Context through the host's `contextType`
Object.defineProperty(Component, 'contextType', { configurable: true, get: Layers });

const _get = Context.get;

Context.get = (state?: State) => {
  if (!state)
    try {
      return useAmbient();
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
  /**
   * Runs for each State registered by this Provider. Return value is ignored -
   * to run teardown with a State, use `state.set(null, callback)`.
   */
  type ForEach<T> = (state: T) => void;

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

type Digest<T extends State> = (props: Provider.Props<T>) => Context;

function Provider<T extends State>({
  children,
  fallback,
  name,
  ...props
}: Provider.Props<T>) {
  const ambient = useAmbient();
  const digest: Digest<T> = useHook((returns) => {
    const context = new Context(ambient);
    const fresh: State[] = [];

    let applied: Context.Accept<T> | undefined;
    let solo: State | undefined;

    returns(({ is, for: input, ...rest }) => {
      if (input !== applied) {
        const single = State.is(input) || input instanceof State;

        applied = input;
        solo = undefined;

        context.set(input, (state, owned) => {
          if (single) solo = state;
          if (owned) fresh.push(state);
          if (is) is(state);
        });
      }

      if (solo && Object.keys(rest).length) solo.set(rest);

      return context;
    });

    return () => {
      const release = fresh.map((state) => state.mount?.());

      return () => {
        for (const done of release) if (done) done();
        context.pop();
      };
    };
  });

  return createProvider(
    digest(props),
    fallback !== undefined
      ? Runtime.createElement(Runtime.Suspense, { fallback, name }, children)
      : children
  );
}

export { Consumer, Provider, Context, createProvider };
