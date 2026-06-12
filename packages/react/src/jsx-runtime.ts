import { Children, isValidElement } from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { host } from '@expressive/mvc/jsx-runtime';

import type { Component } from '@expressive/mvc';

host({
  jsx,
  jsxs,
  Fragment,
  childrenOf: (children) => Children.toArray(children as React.ReactNode) as Component.Node[],
  isElement: isValidElement,
  typeOf: (node) => isValidElement(node) ? node.type : undefined,
  propsOf: (node) => isValidElement(node) ? node.props as Record<string, unknown> : {}
});

export * from '@expressive/mvc/jsx-runtime';
