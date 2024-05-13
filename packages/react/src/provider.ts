import Model, { Context } from '@expressive/mvc';

import { Pragma } from './adapter';

declare namespace Provider {
  interface Props<T extends Model> {
    for: Context.Accept<T>;
    children?: JSX.Element | null | void | (JSX.Element)[];
    set?: Model.Assign<T>;
  }
}

function Provider<T extends Model>(props: Provider.Props<T>){
  const context = Pragma.useContext(true);
  
  context.include(props.for, props.set);

  return Pragma.useProvider(context, props.children);
}

export { Provider };