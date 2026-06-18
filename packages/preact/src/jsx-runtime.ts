import { isValidElement } from 'preact';
import { Children } from 'preact/compat';
import { Fragment, jsx, jsxs } from 'preact/jsx-runtime';
import { host } from '@expressive/mvc/jsx-runtime';

import type { Component } from '@expressive/mvc';
import type { ComponentChildren, JSX as PreactJSX, Ref } from 'preact';

declare module '@expressive/mvc/jsx-runtime' {
  interface Host {
    node: ComponentChildren;
    intrinsics: PreactJSX.IntrinsicElements;
  }
}

declare module '@expressive/mvc' {
  namespace Component {
    interface BaseProps<T extends Component> {
      /**
       * Ref which receives the instance of this component.
       * (Preact JSX does not add `ref` for non-preact classes, so it is
       * declared here - React infers it from its own class attributes.)
       */
      ref?: Ref<T>;
    }
  }
}

host({
  jsx,
  jsxs,
  Fragment,
  isElement: isValidElement,
  childrenOf(children: ComponentChildren): Component.Node[] {
    return Children.toArray(children);
  },
  typeOf(node){
    return isValidElement(node) ? node.type : undefined;
  },
  propsOf(node){
    return isValidElement(node) ? node.props as Record<string, unknown> : {};
  }
});
