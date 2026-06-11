import { Context, State } from '@expressive/mvc';
import {
  createComponent,
  createComputed,
  createContext,
  createMemo,
  JSX,
  onCleanup,
  splitProps,
  useContext
} from 'solid-js';

const Lookup = createContext(Context.root);

declare namespace Consumer {
  interface Props<T extends State> {
    /** Type of controller to fetch from context. */
    for: State.Extends<T>;

    /**
     * Render function, will receive a reactive proxy of desired controller.
     *
     * Values are signal accessors - reads within JSX stay subscribed to
     * updates with Solid's normal fine-grained reactivity.
     */
    children: (value: State.Reactive<T>) => JSX.Element;
  }
}

function Consumer<T extends State>(props: Consumer.Props<T>) {
  return createMemo(() =>
    props.children(props.for.get())
  ) as unknown as JSX.Element;
}

declare namespace Provider {
  type ForEach<T> = (state: T) => void | (() => void);

  interface SharedProps {
    /** Children to render within this Provider. */
    children?: JSX.Element;
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
  const [own, rest] = splitProps(
    props as Provider.ForSingleProps<T> & Provider.ForMultipleProps<T>,
    ['for', 'is', 'children']
  );

  const context = useContext(Lookup).push();

  onCleanup(() => context.pop());

  createComputed(() => {
    const input = own.for;

    context.set(input, own.is as Provider.ForEach<T> | undefined);

    const values = { ...rest } as unknown as State.Assign<T>;

    if (Object.keys(values).length) {
      const instance = State.is(input) ? context.get(input) : input;

      if (instance instanceof State) instance.set(values);
    }
  });

  return createComponent(Lookup.Provider, {
    value: context,
    get children() {
      return own.children;
    }
  });
}

export { Consumer, Provider, Context, Lookup };
