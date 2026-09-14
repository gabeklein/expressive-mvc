import { Fragment, host } from '@expressive/mvc/runtime';

import { childrenOf, isVNode, vnode } from './vnode';
import type { Node, VNode } from './vnode';
import { transition } from './scheduler';

type EventAttributes = {
  [K in keyof GlobalEventHandlersEventMap as `on${Capitalize<K & string>}`]?:
    (event: GlobalEventHandlersEventMap[K]) => unknown;
} & {
  [K in keyof GlobalEventHandlersEventMap as `on${Capitalize<K & string>}Capture`]?:
    (event: GlobalEventHandlersEventMap[K]) => unknown;
};

type Attributes<T extends Element> = EventAttributes & {
  [K in keyof T as K extends 'children' | 'className' | 'style'
    ? never
    : T[K] extends Function
      ? never
      : K]?: T[K] | string | number | boolean;
} & {
  children?: Node;
  class?: string;
  className?: string;
  dangerouslySetInnerHTML?: { __html: string };
  key?: string | number | null;
  ref?: ((node: T | null) => unknown) | { current: T | null };
  style?: string | Partial<CSSStyleDeclaration>;
  [attribute: `data-${string}`]: unknown;
  [attribute: `aria-${string}`]: unknown;
};

type Intrinsics = {
  [K in keyof HTMLElementTagNameMap]: Attributes<HTMLElementTagNameMap[K]>;
} & {
  [K in keyof SVGElementTagNameMap]: Attributes<SVGElementTagNameMap[K]>;
};

declare module '@expressive/mvc/runtime' {
  interface Host {
    node: Node;
    intrinsics: Intrinsics;
  }
}

const runtime = {
  jsx: vnode,
  jsxs: vnode,
  Fragment,
  transition,
  childrenOf,
  isElement: isVNode,
  typeOf(node: unknown) {
    return isVNode(node) ? node.type : undefined;
  },
  propsOf(node: unknown) {
    return isVNode(node) ? node.props : {};
  }
};

host(runtime);

const jsx = vnode;
const jsxs = vnode;

export { Fragment, jsx, jsxs };
export type { VNode as JSXElement };
export type { JSX } from '@expressive/mvc/jsx-runtime';
