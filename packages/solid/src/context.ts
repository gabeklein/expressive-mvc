import Model, { Context } from '@expressive/mvc';
import { createContext, createComponent, JSXElement, onCleanup, useContext } from 'solid-js';

const Lookup = createContext(new Context);

declare namespace Provider {
  interface Props<T extends Model> {
    for: Context.Accept<T>;
    set?: Model.Assign<T>;
    children?: JSXElement;
  }
}

function Provider<T extends Model>(props: Provider.Props<T>){
  const context = useContext(Lookup).push();

  context.include(props.for, props.set);

  onCleanup(() => context.pop());

  return createComponent(Lookup.Provider, {
    value: context,
    get children(){
      return props.children;
    }
  });
}

export { Provider, Lookup };