import { Context, Model } from '@expressive/mvc';

import { createProvider, useContext, useOnMount, Pragma } from './useContext';

type Node = JSX.Element | Iterable<Node> | string | number | boolean | null | undefined;

declare namespace Provider {
  type Element = Pragma.FCE<{
    value: Context;
    children?: Pragma.Node;
  }>;

  type Item = Model | Model.Init;

  type Multiple<T extends Item = Item> = { [key: string | number]: T };

  type Instance<E> = E extends (new () => any) ? InstanceType<E> : E extends Model ? E : never;

  type Props<T extends Item = Item> = MultipleProps<T> | NormalProps<T>;

  type NormalProps<E, I = Instance<E>> = {
    for: E;
    children?: Node;
    use?: Model.Assign<I>;
  }

  // FIX: This fails to exclude properties with same key but different type.
  type MultipleProps<T extends Item> = {
    for: Multiple<T>;
    children?: Node;
    use?: Model.Assign<Instance<T>>;
  }
}

function Provider<T extends Provider.Item>(props: Provider.Props<T>): Provider.Element {
  let { for: include, use: assign } = props;

  const context = useContext(ctx => ctx.push());

  if(typeof include == "function" || include instanceof Model)
    include = { [""]: include };
  
  context.include(include, (model, explicit) => {
    if(assign && explicit)
      model.set(assign);
  });

  useOnMount(() => () => context.pop());

  return createProvider(context, props.children);
}

export { Provider };