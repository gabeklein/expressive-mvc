import { Model } from '@expressive/mvc';

import { createProvider, useOnMount, useContextMemo, Pragma } from './useContext';

declare namespace Provider {
  type Multiple<T extends Model> = {
    [key: string | number]: Model.Init<T> | T;
  };

  interface Props<T extends Model> {
    for: Multiple<T> | Model.Init<T> | T;
    children?: Pragma.Node;
    set?: Model.Assign<T>;
  }
}

function Provider<T extends Model>(props: Provider.Props<T>){
  let { children, for: include, set: assign } = props;

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