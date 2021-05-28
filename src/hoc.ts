import type Public from '../types';
import type { ComponentClass, ComponentType, FunctionComponent } from 'react';

import Oops from './issues';
import { withProvider } from './context';
import { Controller } from './dispatch';
import { defineLazy } from './util';

export function createHocFactory<T = any, P = {}>
  (Type: Public.Component<P, T>): (inject: T) => ComponentType<P> {

  if(typeof Type !== "function")
    throw Oops.BadHOCArgument();

  if(Type.prototype && Type.prototype.isReactComponent)
    return classTypeHOC<T, P>(Type as any);
  else
    return functionHOC<T, P>(Type as any);
}

function classTypeHOC<T, P>
  (Type: ComponentClass<P>){

  return (inject: T) =>
    class extends Type {
      constructor(props: P){
        super(props, inject);
      }
    }
}

function functionHOC<T, P>
  (Type: FunctionComponent<P>){

  return (inject: T) =>
    (props: P) => Type(props, inject);
}

export function setComponent
  (Type: Public.Component<{}>){

  const componentFor = createHocFactory(Type);

  return Controller.define((key, { subject }) => {
    defineLazy(subject, key, () =>
      componentFor(subject as any)
    )
  })
}

export function setParentComponent
  (Type: Public.Component<{}>){

  const componentFor = createHocFactory(Type);

  return Controller.define((key, on) => {
    const control = on.subject as any;

    defineLazy(control, key, () => {
      const Component = componentFor(control);
      return withProvider(Component, control)
    })
  })
}