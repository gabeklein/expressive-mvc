import { State, Context } from '@expressive/state';
import {
  createContext,
  createElement,
  ReactNode,
  Suspense,
  useContext,
  useRef
} from 'react';
import { useMount } from './state';

const Layers = createContext(new Context());

const _get = Context.get;

Context.get = (state?: State) => {
  if (state) return _get(state);
  try {
    return useContext(Layers);
  } catch {
    return Context.root;
  }
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
    children: (value: T) => ReactNode | void;
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
    children?: ReactNode;

    /** A fallback tree to show when suspended. */
    fallback?: ReactNode;

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
  const ambient = useContext(Layers);
  const ref = useRef<Context | null>(null);
  const context = ref.current || (ref.current = new Context(ambient));

  let {
    for: input,
    children,
    fallback,
    name,
    ...rest
  } = props as Provider.ForSingleProps<T> & Provider.ForMultipleProps<T>;

  context.set(input, (added) => rest.is?.(added));

  if (Object.keys(rest).length) {
    if (State.is(input)) input = context.get(input) as T;
    if (input instanceof State) input.set(rest as State.Assign<T>);
  }

  useMount(() => () => context.pop());

  if (fallback !== undefined)
    children = createElement(Suspense, { fallback, name }, children);

  return createElement(Layers.Provider, { value: context, children });
}

export { Consumer, Provider, Context, Layers };
