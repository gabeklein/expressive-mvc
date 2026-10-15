import { Context, State } from '@expressive/mvc';

import type { Key, Node as RenderNode } from '../node/vnode';
import type { Appearance, Claim } from '../style/claim';
import type { Scope } from './adapter';

type Container = Element | DocumentFragment;

type Kind = 'collection' | 'component' | 'element' | 'fragment' | 'function' | 'portal' | 'text';

interface Boundary {
  catch?: (error: Error) => Promise<void> | void;
  fallback: () => RenderNode;
  owner?: Fiber;
  parent?: Boundary;
  waiting?: Set<Fiber>;
}

interface Renderable extends State {
  props?: Record<string, any>;
  key?: Key;
  fallback?: RenderNode | false;
  catch?(error: Error, instance: Renderable): Promise<void> | void;
  mount?(): (() => void) | void;
  render?(props?: any): RenderNode;
}

type Placement = Pick<Renderable, 'fallback' | 'catch'>;

interface Fiber {
  kind: Kind;
  key?: Key;
  type?: unknown;
  value?: unknown;
  source?: unknown;
  props?: Record<string, any>;
  context: Context;
  boundary?: Boundary;
  ownBoundary?: Boundary;
  start: globalThis.Node;
  end: globalThis.Node;
  children: Fiber[];
  scope?: Scope;
  cleanup?: (() => void) | void;
  release?: () => void;
  childContext?: Context;
  instance?: Renderable;
  owned?: boolean;
  events?: Map<string, EventListener>;
  portalStart?: globalThis.Node;
  portalEnd?: globalThis.Node;
  portalContainer?: Container;
  suspended?: Set<() => void>;
  applied?: boolean;
  retried?: boolean;
  portals?: [Fiber, DocumentFragment][];
  dead?: boolean;
  waitingOn?: Boundary;
  recovering?: object;
  stash?: DocumentFragment;
  placeholder?: Fiber;
  staging?: DocumentFragment;
  render?: () => RenderNode;
  appearance?: Appearance;
  consumed?: boolean;
  claimed?: Claim;
}

function range(kind: Kind, parent: globalThis.Node, before: globalThis.Node | null, context: Context): Fiber {
  const start = document.createComment(kind);
  const end = document.createComment(`/${kind}`);

  parent.insertBefore(start, before);
  parent.insertBefore(end, before);

  return { kind, context, start, end, children: [] };
}

function makeScope(kind: Scope['kind'], context: Context, update: (passive: boolean) => void): Scope {
  return {
    active: true,
    childContext: context,
    context,
    kind,
    subscriptions: [],
    update,
    useIndex: 0,
    uses: []
  };
}

function moveRange(start: globalThis.Node, end: globalThis.Node, target: globalThis.Node) {
  let node: globalThis.Node | null = start;

  while (node) {
    const next: globalThis.Node | null = node.nextSibling;
    target.appendChild(node);
    if (node === end) break;
    node = next;
  }
}

function move(fiber: Fiber, parent: globalThis.Node, before: globalThis.Node | null) {
  if (fiber.start.parentNode === parent && fiber.end.nextSibling === before) return;

  let node: globalThis.Node | null = fiber.start;
  while (node) {
    const next: globalThis.Node | null = node.nextSibling;
    parent.insertBefore(node, before);
    if (node === fiber.end) break;
    node = next;
  }
}

function removeRange(start: globalThis.Node, end: globalThis.Node) {
  let node = start;

  while (true) {
    const next = node.nextSibling;
    (node as ChildNode).remove();
    if (node === end) break;
    node = next!;
  }
}

export { makeScope, move, moveRange, range, removeRange };
export type { Boundary, Container, Fiber, Placement, Renderable };
