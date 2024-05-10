import { Context, Model } from '@expressive/mvc';

import { createProvider, useContext, useOnMount } from './useContext';

interface ProviderProps<T extends Model> {
  for: Context.Input | Model.Init<T> | Model;
  use?: Model.Assign<T>;
  children?: unknown;
}

function Provider<T extends Model>(props: ProviderProps<T>){
  let { for: include, use: assign } = props;

  const context = useContext(ctx => ctx.push());

  if(typeof include == "function" || include instanceof Model)
    include = { [""]: include };
  
  context.include(include, (model, explicit) => {
    if(assign && explicit)
      model.set(assign);
  });

  useOnMount(() => () => context.pop());

  return createProvider(context, props.children as JSX.Element);
}

export { Provider };