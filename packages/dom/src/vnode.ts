const VNODE = Symbol('@expressive/dom.vnode');
const PORTAL = Symbol('@expressive/dom.portal');

type Key = string | number | null | undefined;
type FunctionComponent<P = any> = (props: P) => Node;
interface ComponentInstance {
  readonly props: any;
  render(props?: any): Node;
}
type ComponentType<P = any> = FunctionComponent<P> | (new (props: P) => ComponentInstance);

type Node =
  | VNode
  | ComponentInstance
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | readonly Node[];

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

function createPortal(children: Node, container: Element | DocumentFragment, key?: Key): VNode {
  return vnode(PORTAL, { children, container }, key);
}

export {
  VNODE,
  PORTAL,
  childrenOf,
  createPortal,
  isVNode,
  vnode
};

export type { ComponentInstance, ComponentType, FunctionComponent, Key, Node, VNode };
