import { Fragment, host } from '@expressive/mvc/jsx-runtime';
import { childrenOf, element, isElement } from './element';

host({
  Fragment,
  jsx: element,
  jsxs: element,
  isElement,
  childrenOf,
  typeOf: (node) => (isElement(node) ? node.type : undefined),
  propsOf: (node) => (isElement(node) ? node.props : {})
});

export { jsx, jsxs, Fragment } from '@expressive/mvc/jsx-runtime';
export type { JSX } from '@expressive/mvc/jsx-runtime';
