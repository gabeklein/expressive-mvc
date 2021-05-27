import type { Controller as Public } from '../types';
import type { ComponentClass, ComponentType, FunctionComponent } from 'react';

import Oops from './issues';

export function createHocFactory<T = any, P = {}>(
  Type: Public.Component<P, T>
): (inject: T) => ComponentType<P> {

  if(typeof Type !== "function")
    throw Oops.BadHOCArgument();

  if(Type.prototype && Type.prototype.isReactComponent)
    return classTypeHOC<T, P>(Type as any);
  else
    return functionHOC<T, P>(Type as any);
}

function classTypeHOC<T, P>(Type: ComponentClass<P>){
  return (inject: T) =>
    class extends Type {
      constructor(props: P){
        super(props, inject);
      }
    }
}

function functionHOC<T, P>(Type: FunctionComponent<P>){
  return (inject: T) =>
    (props: P) => Type(props, inject);
}