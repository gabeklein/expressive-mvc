import type { Component } from './component';
import { Fragment, hostType, resolved } from './jsx';

export { Fragment };

export function jsx(type: unknown, props: object, key?: unknown): Component.Node {
  return resolved().jsx(hostType(type), props, key);
}

export function jsxs(type: unknown, props: object, key?: unknown): Component.Node {
  return resolved().jsxs(hostType(type), props, key);
}

export declare namespace JSX {
  type Element = Component.Node;
  type ElementType =
    | keyof IntrinsicElements
    | ((props: any) => Component.Node)
    | (abstract new (...args: any[]) => Component);
  interface ElementClass extends Component { }
  interface ElementAttributesProperty { props: {} }
  interface ElementChildrenAttribute { children: {} }
  interface IntrinsicAttributes { key?: string | number | null }
  interface IntrinsicElements { }
}
