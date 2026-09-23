const VNODE = Symbol('@expressive/jsx.vnode');
const PORTAL = Symbol('@expressive/jsx.portal');

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

const statics = new WeakSet<object>();

function markStatic<P>(props: P) {
  const children = (props as { children?: unknown }).children;
  if (Array.isArray(children)) statics.add(children);
}

function segmentsOf(value: unknown): string[] {
  const output: string[] = [];

  function add(child: unknown, segment: string, dynamic: boolean) {
    if (Array.isArray(child)) {
      const fixed = !dynamic && statics.has(child);
      child.forEach((item, index) => add(item, fixed ? String(index) : `${segment}*`, !fixed));
    } else if (child !== null && child !== undefined && typeof child != 'boolean')
      output.push(!dynamic && isVNode(child) && child.key != null ? `${segment}~${child.key}` : segment);
  }

  add(value, '', false);
  return output;
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
  markStatic,
  segmentsOf,
  vnode
};

export type { ComponentInstance, ComponentType, FunctionComponent, Key, Node, VNode };
