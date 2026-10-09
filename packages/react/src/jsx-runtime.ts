import { Children, isValidElement } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { host } from '@expressive/mvc/jsx-runtime';

import type { Component as ReactComponent, JSX as ReactJSX, ReactNode } from 'react';

declare module '@expressive/mvc/jsx-runtime' {
  interface Host {
    node: ReactNode;
    intrinsics: ReactJSX.IntrinsicElements;
    elementClass: ReactComponent<any, any>;
  }
}

host({
  jsx,
  jsxs,
  Fragment,
  isElement: isValidElement,
  childrenOf: Children.toArray,
  typeOf(node){
    return isValidElement(node) ? node.type : undefined;
  },
  propsOf(node){
    return isValidElement(node) ? node.props as Record<string, unknown> : {};
  }
});
