import Model, { Context } from '@expressive/mvc';
import React from 'react';

import { Pragma } from './hooks';

declare namespace Provider {
  interface Props<T extends Model> {
    for: Context.Accept<T>;
    children?: React.ReactNode;
    set?: Model.Assign<T>;
  }
}

function Provider<T extends Model>(props: Provider.Props<T>){
  const context = Pragma.useContext(true);
  
  context.include(props.for, props.set);

  return Pragma.useProvider(context, props.children);
}

export { Provider };