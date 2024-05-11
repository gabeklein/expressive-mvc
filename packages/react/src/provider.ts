import { Context, Model } from '@expressive/mvc';

import { createProvider, useOnMount, useContextMemo, Pragma } from './useContext';

declare namespace Provider {
  interface Props<T extends Model> {
    for: Context.Accept<T>;
    children?: Pragma.Node;
    set?: Model.Assign<T>;
  }
}

function Provider<T extends Model>(props: Provider.Props<T>){
  let { children, for: include, set: assign } = props;

  const context = useContextMemo(ctx => ctx.push());
  
  context.include(include, assign);

  useOnMount(() => () => context.pop());

  return createProvider(context, children as Pragma.Node);
}

export { Provider };