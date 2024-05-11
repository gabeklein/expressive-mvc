import { Context, Model } from '@expressive/mvc';

import { createProvider, useOnMount, useContextMemo, Pragma } from './useContext';

interface ProviderProps<T extends Model> {
  for: Context.Input | Model.Init<T> | Model;
  use?: Model.Assign<T>;
  children?: unknown;
}

declare namespace Provider {
  type Item = Model | Model.Init;

  type Multiple<T extends Item = Item> = { [key: string | number]: T };

  type Instance<E> = E extends (new () => any) ? InstanceType<E> : E extends Model ? E : never;

  interface NormalProps<E, I = Instance<E>> {
    for: E;
    children?: Pragma.Node;
    use?: Model.Assign<I>;
  }

  // FIX: This fails to exclude properties with same key but different type.
  interface MultipleProps<T extends Item> {
    for: Multiple<T>;
    children?: Pragma.Node;
    use?: Model.Assign<Instance<T>>;
  }

  type Props<T extends Item = Item> = MultipleProps<T> | NormalProps<T>;
}

function Provider<T extends Model>(props: ProviderProps<T>){
  let { children, for: include, use: assign } = props;

  const context = useContextMemo(ctx => ctx.push());

  if(typeof include == "function" || include instanceof Model)
    include = { [""]: include };
  
  context.include(include, (model, explicit) => {
    if(assign && explicit)
      model.set(assign);
  });

  useOnMount(() => () => context.pop());

  return createProvider(context, children as Pragma.Node);
}

export { Provider };