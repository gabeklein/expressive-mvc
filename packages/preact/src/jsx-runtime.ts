import { isValidElement } from 'preact';
import { Children } from 'preact/compat';
import { Fragment, jsx, jsxs } from 'preact/jsx-runtime';
import { host } from '@expressive/mvc/jsx-runtime';

import type { Component } from '@expressive/mvc';
import type { ComponentChildren, JSX as PreactJSX } from 'preact';

declare module '@expressive/mvc/jsx-runtime' {
  interface Host {
    node: ComponentChildren;
    intrinsics: PreactJSX.IntrinsicElements;
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
