import { Context, Model } from '@expressive/mvc';
import {
  createContext,
  createElement,
  FunctionComponentElement,
  ProviderProps,
  ReactNode,
  Suspense,
  useContext,
  useEffect,
  useMemo,
} from 'react';

export const LookupContext = createContext(new Context());
export const Pending = new WeakMap<{}, ((context: Context) => void)[]>();
export const useLookup = () => useContext(LookupContext);

declare namespace Provider {
  type Item = Model | Model.New;

  type Multiple<T extends Item = Item> = { [key: string | number]: T };

  type Instance<E> = E extends (new () => any) ? InstanceType<E> : E extends Model ? E : never;

  type Props<T extends Item = Item> = MultipleProps<T> | NormalProps<T>;

  type NormalProps<E, I = Instance<E>> = {
    for: E;
    fallback?: ReactNode;
    children?: ReactNode;
    use?: Model.Values<I>;
  }

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> = {
    for: Multiple<T>;
    fallback?: ReactNode;
    children?: ReactNode;
    use?: Model.Values<Instance<T>>;
  }
}

function Provider<T extends Provider.Item>(
  props: Provider.Props<T>
): FunctionComponentElement<ProviderProps<Context>> {
  let { for: included, use: assign, children, fallback } = props;

  const ambient = useLookup();
  const context = useMemo(() => ambient.push(), []);
  const reject = (value: any) => {
    throw new Error(`Provider expects a Model instance or class but got ${value}.`);
  }

  if(!included)
    reject(included);

  if(typeof included == "function" || included instanceof Model)
    included = { [0]: included };

  Object.entries(included).forEach(([K, V]) => {
    if(!(Model.is(V) || V instanceof Model))
      reject(`${V} as ${K}`);
  })
  
  context.include(included).forEach((isExplicit, model) => {
    if(assign && isExplicit)
      for(const K in assign)
        if(K in model)
          (model as any)[K] = (assign as any)[K];

    const pending = Pending.get(model);

    if(pending)
      pending.forEach(cb => cb(context));
  });

  useEffect(() => () => context.pop(), []);

  return createElement(LookupContext.Provider, { value: context, key: context.key },
    fallback === false ? children : createElement(Suspense, { fallback }, children)
  );
}

export { Provider };