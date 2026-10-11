import { Fragment as FRAGMENT } from '@expressive/mvc/jsx-runtime';
import type { has, map } from '@expressive/mvc';
import type { JSX as Runtime } from './jsx-runtime';

const VNODE = Symbol('@expressive/dom.vnode');
const PORTAL = Symbol('@expressive/dom.portal');

type Key = string | number | null | undefined;
type FunctionComponent<P = any> = (props: P) => Node;
interface ComponentInstance {
  render(props?: any): Node;
}
type ComponentType<P = any> = FunctionComponent<P> | (abstract new (...args: any[]) => object);

type Node =
  | VNode
  | ComponentInstance
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | readonly Node[]
  | has.List<Node>
  | has.Pool<Node, any, any>
  | map.Managed<unknown, Node>;

interface VNode<P = any> {
  readonly [VNODE]: true;
  readonly type: string | symbol | ComponentType<P>;
  readonly props: P & { children?: Node };
  readonly key?: Key;
}

function vnode<P>(type: VNode<P>['type'], props: P, key?: unknown): VNode<P> {
  return {
    [VNODE]: true,
    type,
    props: (props || {}) as VNode<P>['props'],
    key: key as Key
  };
}

function createElement(type: VNode['type'], props?: Record<string, unknown> | null, ...children: unknown[]): VNode {
  const { key, ...rest } = props || {};

  if (children.length) rest.children = children.length == 1 ? children[0] : children;

  return vnode(type, rest, key);
}

type JsxElement = Runtime.Element;
type JsxElementType = Runtime.ElementType;
type JsxElementClass = Runtime.ElementClass;
type JsxAttributesProperty = Runtime.ElementAttributesProperty;
type JsxManaged<C, P> = Runtime.LibraryManagedAttributes<C, P>;
type JsxChildrenAttribute = Runtime.ElementChildrenAttribute;
type JsxIntrinsicAttributes = Runtime.IntrinsicAttributes;
type JsxIntrinsicElements = Runtime.IntrinsicElements;

declare namespace createElement {
  namespace JSX {
    type Element = JsxElement;
    type ElementType = JsxElementType;
    interface ElementClass extends JsxElementClass {}
    interface ElementAttributesProperty extends JsxAttributesProperty {}
    type LibraryManagedAttributes<C, P> = JsxManaged<C, P>;
    interface ElementChildrenAttribute extends JsxChildrenAttribute {}
    interface IntrinsicAttributes extends JsxIntrinsicAttributes {}
    type IntrinsicElements = JsxIntrinsicElements;
  }
}

function isVNode(value: unknown): value is VNode {
  return !!value && typeof value == 'object' && (value as VNode)[VNODE] === true;
}

function childrenOf(value: unknown): Node[] {
  const output: Node[] = [];

  function add(child: unknown) {
    if (Array.isArray(child)) child.forEach(add);
    else if (child !== null && child !== undefined && typeof child != 'boolean')
      output.push(child as Node);
  }

  add(value);
  return output;
}

const Fragment = FRAGMENT as unknown as (props: { children?: Node }) => Node;
const Portal = PORTAL as unknown as (props: { into: Element | DocumentFragment | string; children?: Node }) => Node;

export {
  VNODE,
  PORTAL,
  childrenOf,
  createElement,
  Fragment,
  Portal,
  isVNode,
  vnode
};

export type { ComponentInstance, ComponentType, FunctionComponent, Key, Node, VNode };
