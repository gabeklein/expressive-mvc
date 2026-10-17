import { Fragment, host } from '@expressive/mvc/jsx-runtime';
import type { Component, Model } from '@expressive/mvc';
import type { JSX as Base } from '@expressive/mvc/jsx-runtime';

import { childrenOf, isVNode, vnode } from './vnode';
import type { Node, VNode } from './vnode';
import type { Attributes as Loaded, Module } from './loader';

declare module '@expressive/mvc/jsx-runtime' {
  interface Host {
    node: Node;
    element: () => PromiseLike<Module>;
    elementClass: Model;
  }
}

declare module '@expressive/mvc' {
  namespace Model {
    /** JSX attributes of a Model with no `props` member: its settable fields, `is`, a boundary, and what `render` accepts. */
    type Props<T extends Model> =
      & Component.ModelProps<T>
      & {
        is?: (instance: T) => void;
        /** Shown while this element's content is suspended or recovering. `false` opts out. */
        fallback?: Reserved<T, 'fallback', Component.Node | false>;
        /** Called when this element's content throws. A returned promise retries once settled. */
        catch?: Reserved<T, 'catch', (error: Error, instance: T) => Promise<void> | void>;
      }
      & Component.RenderProps<T extends { render: infer R } ? R : never>;

    /** Boundary attribute type, narrowed by a member of the same name so a mismatch fails at the element. */
    type Reserved<T, K extends string, V> = K extends keyof T ? T[K] & V : V;
  }
}

declare module '@expressive/mvc/jsx-runtime' {
  namespace JSX {
    interface IntrinsicAttributes {
      [attribute: `_${string}`]: unknown;
    }
  }
}

host({
  jsx: vnode,
  jsxs: vnode,
  Fragment,
  childrenOf,
  isElement: isVNode,
  typeOf(node: unknown) {
    return isVNode(node) ? node.type : undefined;
  },
  propsOf(node: unknown) {
    return isVNode(node) ? node.props : {};
  }
});

const jsx = vnode;
const jsxs = vnode;

export { Fragment, jsx, jsxs };
export type { VNode as JSXElement };
export declare namespace JSX {
  type Element = Base.Element;
  type ElementType =
    | keyof IntrinsicElements
    | ((props: any) => Component.Node)
    | (() => PromiseLike<Module>)
    | (abstract new (...args: any[]) => ElementClass);
  /**
   * Any Model renders as a class element - one with `render` produces content,
   * one without passes children through and provides itself.
   */
  interface ElementClass extends Model { render?(props?: any): Component.Node }
  /**
   * Empty, so a class element's attributes resolve from its instance type and
   * {@link LibraryManagedAttributes} picks `props` when declared, else derives
   * them from the Model.
   */
  interface ElementAttributesProperty {}
  type LibraryManagedAttributes<C, P> =
    C extends abstract new (...args: any[]) => infer I
      ? P extends { props: infer Q } ? Q
      : I extends Model ? Model.Props<I>
      : P
      : C extends () => PromiseLike<Module<infer T>>
      ? Loaded<T>
      : P;
  interface ElementChildrenAttribute extends Base.ElementChildrenAttribute {}
  interface IntrinsicAttributes extends Base.IntrinsicAttributes {}
  type IntrinsicElements = Base.IntrinsicElements;
}
