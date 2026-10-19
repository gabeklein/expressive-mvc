import { Context, Model } from '@expressive/mvc';

import type { Key, Node as RenderNode } from '../node/vnode';
import type { Appearance, Claim } from '../style/claim';
import type { Scope } from './adapter';
import { host } from './host';
import type { HostNode } from './host';

type Container = HostNode;

type Kind = 'collection' | 'component' | 'element' | 'fragment' | 'function' | 'portal' | 'text';

interface Boundary {
  catch?: (error: Error) => Promise<void> | void;
  fallback: () => RenderNode;
  owner?: Fiber;
  parent?: Boundary;
  waiting?: Set<Fiber>;
}

interface Renderable extends Model {
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
  start: HostNode;
  end: HostNode;
  children: Fiber[];
  scope?: Scope;
  cleanup?: (() => void) | void;
  release?: () => void;
  childContext?: Context;
  instance?: Renderable;
  owned?: boolean;
  portalStart?: HostNode;
  portalEnd?: HostNode;
  portalContainer?: Container;
  suspended?: Set<() => void>;
  applied?: boolean;
  retried?: boolean;
  portals?: [Fiber, HostNode][];
  dead?: boolean;
  waitingOn?: Boundary;
  recovering?: object;
  stash?: HostNode;
  placeholder?: Fiber;
  staging?: HostNode;
  render?: () => RenderNode;
  appearance?: Appearance;
  consumed?: boolean;
  claimed?: Claim;
}

function range(kind: Kind, parent: HostNode, before: HostNode | null, context: Context): Fiber {
  const start = host.marker(kind);
  const end = host.marker(`/${kind}`);

  host.insert(parent, start, before);
  host.insert(parent, end, before);

  return { kind, context, start, end, children: [] };
}

function makeScope(context: Context, update: (passive: boolean) => void): Scope {
  return {
    active: true,
    context,
    subscriptions: [],
    update
  };
}

function moveRange(start: HostNode, end: HostNode, target: HostNode) {
  let node: HostNode | null = start;

  while (node) {
    const next: HostNode | null = host.next(node);
    host.insert(target, node, null);
    if (node === end) break;
    node = next;
  }
}

function move(fiber: Fiber, parent: HostNode, before: HostNode | null) {
  if (host.parent(fiber.start) === parent && host.next(fiber.end) === before) return;

  let node: HostNode | null = fiber.start;
  while (node) {
    const next: HostNode | null = host.next(node);
    host.insert(parent, node, before);
    if (node === fiber.end) break;
    node = next;
  }
}

function removeRange(start: HostNode, end: HostNode) {
  let node = start;

  while (true) {
    const next = host.next(node);
    host.remove(node);
    if (node === end) break;
    node = next!;
  }
}

export { makeScope, move, moveRange, range, removeRange };
export type { Boundary, Container, Fiber, Placement, Renderable };
