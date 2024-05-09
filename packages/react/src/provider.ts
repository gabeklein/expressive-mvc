import { Context, Model } from '@expressive/mvc';

import { createProvider, useShared, useEffect, useMemo } from './useContext';

interface ProviderProps<T extends Model> {
  for: Context.Input | Model.Init<T> | Model;
  use?: Model.Assign<T>;
  children?: unknown;
}

function Provider<T extends Model>(props: ProviderProps<T>){
  let { for: include, use: assign } = props;

  const ambient = useShared();
  const context = useMemo(() => ambient.push(), []);

  if(typeof include == "function" || include instanceof Model)
    include = { [""]: include };
  
  context.include(include, (model, explicit) => {
    if(assign && explicit)
      model.set(assign);
  });

  useEffect(() => () => context.pop(), []);

  return createProvider(context, props.children as JSX.Element);
}

export { Provider };