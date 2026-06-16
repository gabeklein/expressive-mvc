import { Children, isValidElement } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { host } from '@expressive/mvc/jsx-runtime';

import type { Component } from '@expressive/mvc';
import type { JSX as ReactJSX, ReactNode } from 'react';

declare module '@expressive/mvc/jsx-runtime' {
  interface Host {
    node: ReactNode;
    intrinsics: ReactJSX.IntrinsicElements;
  }
}

host({
  jsx,
  jsxs,
  Fragment,
  isElement: isValidElement,
  childrenOf(children): Component.Node[] {
    return Children.toArray(children as React.ReactNode);
  },
  typeOf(node){
    return isValidElement(node) ? node.type : undefined;
  },
  propsOf(node){
    return isValidElement(node) ? node.props as Record<string, unknown> : {};
  }
});
