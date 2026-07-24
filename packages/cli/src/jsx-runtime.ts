import { Fragment, host } from '@expressive/mvc/jsx-runtime';

declare module '@expressive/mvc/jsx-runtime' {
  interface Host {
    node: Element.Node;
  }
}

declare namespace Element {
  type Type = unknown;

  type Node =
    | string
    | number
    | boolean
    | null
    | undefined
    | Element
    | readonly Node[];
}

const ELEMENT = Symbol.for('@expressive/cli.element');

interface Element {
  [ELEMENT]: true;
  type: Element.Type;
  props: Record<string, unknown>;
  key?: unknown;
}

function element(type: unknown, props: object, key?: unknown): Element {
  return {
    [ELEMENT]: true,
    type,
    props: props as Record<string, unknown>,
    key
  };
}

function isElement(node: unknown): node is Element {
  return typeof node == 'object' && node !== null && ELEMENT in node;
}

function childrenOf(children: unknown): Element.Node[] {
  if (children == null || typeof children == 'boolean') return [];
  if (Array.isArray(children)) return children.flatMap(childrenOf);
  return [children as Element.Node];
}

host({
  Fragment,
  jsx: element,
  jsxs: element,
  isElement,
  childrenOf,
  typeOf: (node) => (isElement(node) ? node.type : undefined),
  propsOf: (node) => (isElement(node) ? node.props : {})
});

export type { Element };
export { ELEMENT, isElement, childrenOf };
export { jsx, jsxs, Fragment } from '@expressive/mvc/jsx-runtime';
export type { JSX } from '@expressive/mvc/jsx-runtime';
