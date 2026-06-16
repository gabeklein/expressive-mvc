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
  childrenOf: (children) => Children.toArray(children as ComponentChildren) as Component.Node[],
  isElement: isValidElement,
  typeOf: (node) => isValidElement(node) ? node.type : undefined,
  propsOf: (node) => isValidElement(node) ? node.props as Record<string, unknown> : {}
});
