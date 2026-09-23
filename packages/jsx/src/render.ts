import { Component, Context } from '@expressive/mvc';
import { has, map } from '@expressive/mvc';
import { watch } from '@expressive/mvc/observable';
import { Fragment } from '@expressive/mvc/runtime';

import { commit, dispose, enter } from './adapter';
import type { Scope } from './adapter';
import {
  appearanceRoot,
  appearanceToken,
  createAppearanceToken,
  emitClass,
  enterAppearance
} from './appearance-protocol';
import type { AppearanceContext, ResolvedAppearance } from './appearance-protocol';
import { Provider, provide } from './context';
import { claim as dequeue, release, schedule, settle as absorb, transition } from './scheduler';
import { PORTAL, childrenOf, isVNode } from './vnode';
import type { Key, Node as RenderNode, VNode } from './vnode';

type Container = Element | DocumentFragment;
type Kind = 'collection' | 'component' | 'element' | 'fragment' | 'function' | 'portal' | 'provider' | 'text';

interface Boundary {
  catch?: (error: Error) => Promise<void> | void;
  fallback: () => RenderNode;
  owner?: Fiber;
  parent?: Boundary;
  waiting?: Set<Fiber>;
}

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
  instance?: Component;
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
  stash?: DocumentFragment;
  placeholder?: Fiber;
  appearance?: Appearance;
  consumed?: boolean;
  appearanceRoute?: unknown;
  claimed?: Claim;
}

interface Appearance {
  context?: AppearanceContext;
  entries: Forwarded[];
}

interface Forwarded {
  hops: number;
  style: Style;
}

interface Carried {
  appearance: ResolvedAppearance;
  doors: number;
}

interface Collected {
  classes: string[];
  declarations: Record<string, unknown>;
  tokens: Carried[];
}

interface Claim {
  className: string;
  context?: AppearanceContext;
  declarations: Record<string, unknown>;
}

const roots = new WeakMap<Container, () => void>();
const SVG = 'http://www.w3.org/2000/svg';
const dirty = new Set<Boundary>();
const stashes = new WeakMap<globalThis.Node, Fiber>();
const CONTROLS = ['checked', 'value'];
let passiveRender = false;
let depth = 0;
let settling = false;
let rendering: object | undefined;
let touched = false;
const observed = new WeakMap<object, Record<string, any>>();
const tickets = new WeakMap<object, Ticket>();

interface Ticket {
  classes: string[];
  tokens: Carried[];
}

function render(node: RenderNode, container: Container): () => void {
  roots.get(container)?.();
  container.replaceChildren();

  const context = new Context(Context.root);
  const fiber = range('fragment', container, null, context);

  try {
    pass(() => {
      const appearanceContext = appearanceRoot();
      reconcile(fiber, node, context, undefined, appearanceContext ? { context: appearanceContext, entries: [] } : undefined);
    });
  } catch (error) {
    unmountFiber(fiber);
    context.pop();
    throw error;
  }

  let active = true;
  const unmount = () => {
    if (!active) return;
    active = false;
    unmountFiber(fiber);
    context.pop();
    roots.delete(container);
  };

  roots.set(container, unmount);
  return unmount;
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

function complete<T extends Fiber>(fiber: T, work: () => void): T {
  try {
    work();
  } catch (error) {
    unmountFiber(fiber);
    throw error;
  }

  return fiber;
}

function componentProps(
  type: unknown,
  props: Record<string, any>,
  appearance: Appearance | undefined,
  parent: globalThis.Node,
  route?: unknown
) {
  const context = appearance?.context;
  if (!context || typeof type != 'function') return { appearance, props, route };

  const resolved = context.resolve(
    route,
    (type as { displayName?: string }).displayName ?? type.name,
    props,
    parent.ownerDocument!
  );
  const value = resolved.appearance;
  if (!value) return { appearance, props, route: resolved.route };

  const token = createAppearanceToken(value);
  return {
    appearance: {
      context: value.context || context,
      entries: appearance!.entries
    },
    props: { ...props, style: [token, props.style] },
    route: resolved.route
  };
}

function mount(value: RenderNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary, appearance?: Appearance): Fiber {
  if (typeof value == 'string' || typeof value == 'number' || typeof value == 'bigint') {
    const text = document.createTextNode(String(value));
    parent.insertBefore(text, before);
    return { kind: 'text', value, context, start: text, end: text, children: [] };
  }

  if (value instanceof Component) return mountComponent(value, parent, before, context, boundary, appearance);
  if (value instanceof has.List || value instanceof has.Pool || value instanceof map.Managed)
    return mountCollection(value, parent, before, context, boundary, appearance);

  if (!isVNode(value)) throw new TypeError(`Cannot render ${String(value)}.`);

  if (value.type === Fragment) return mountFragment(value, parent, before, context, boundary, appearance);
  if (value.type === PORTAL) return mountPortal(value, parent, before, context, boundary, appearance);
  if (value.type === Provider) return mountProvider(value, parent, before, context, boundary, appearance);
  if (typeof value.type == 'string') return mountElement(value, parent, before, context, boundary, appearance);
  if (typeof value.type != 'function')
    throw new Error(`Cannot render ${String(value.type)}.`);

  if (value.type.prototype instanceof Component)
    return mountOwnedComponent(value, parent, before, context, boundary, appearance);

  return mountFunction(value, parent, before, context, boundary, appearance);
}

function mountFragment(value: VNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const fiber = range('fragment', parent, before, context);
  fiber.key = value.key;
  fiber.type = Fragment;
  fiber.appearance = appearance;

  return complete(fiber, () => {
    reconcile(fiber, value.props.children, context, boundary, appearance);
  });
}

function mountFunction(value: VNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const fiber = range('function', parent, before, context);
  const resolved = componentProps(value.type, value.props, appearance, parent);
  fiber.key = value.key;
  fiber.type = value.type;
  fiber.props = observe(resolved.props);
  fiber.boundary = boundary;
  fiber.appearance = resolved.appearance;
  fiber.appearanceRoute = resolved.route;
  fiber.scope = makeScope('function', context, (passive) => runFunction(fiber, passive));

  return complete(fiber, () => {
    runFunction(fiber, passiveRender);
  });
}

function mountOwnedComponent(
  value: VNode,
  parent: globalThis.Node,
  before: globalThis.Node | null,
  context: Context,
  boundary?: Boundary,
  appearance?: Appearance
) {
  const resolved = componentProps(value.type, value.props, appearance, parent);
  const instance = new (value.type as new (props: any) => Component)(observe(resolved.props));
  return mountComponent(instance, parent, before, context, boundary, resolved.appearance, true, value.key, resolved.route);
}

function runFunction(fiber: Fiber, passive: boolean) {
  if (attempt(fiber, passive, () =>
    enter(fiber.scope!, () => (fiber.type as Function)(fiber.props))
  )) commit(fiber.scope!);
}

function mountComponent(
  instance: Component,
  parent: globalThis.Node,
  before: globalThis.Node | null,
  context: Context,
  inherited?: Boundary,
  appearance?: Appearance,
  owned = false,
  key?: Key,
  appearanceRoute?: unknown
) {
  const fiber = range('component', parent, before, context);
  const childContext = context.push(instance);
  const ownBoundary: Boundary | undefined = instance.fallback !== false || instance.catch
    ? {
        catch: instance.catch?.bind(instance),
        fallback: () => instance.fallback,
        owner: fiber,
        parent: inherited
      }
    : inherited;

  fiber.boundary = ownBoundary;
  if (ownBoundary !== inherited) fiber.ownBoundary = ownBoundary;
  fiber.childContext = childContext;
  fiber.instance = instance;
  fiber.key = owned ? key : instance.key;
  fiber.type = instance.constructor;
  fiber.props = instance.props as Record<string, any>;
  fiber.owned = owned;
  fiber.appearance = appearance;
  fiber.appearanceRoute = appearanceRoute;
  fiber.scope = makeScope('component', childContext, (passive) => runComponent(fiber, passive));

  let first = true;
  let proxy = instance;
  fiber.release = watch(instance, (current, events) => {
    const { applied, scope } = fiber;

    proxy = current;
    fiber.applied = undefined;

    if (!first && scope!.active) {
      if (applied && events.includes('props')) transition(() => schedule(scope!));
      else schedule(scope!);
    }

    first = false;
  }, undefined, transition);

  Object.defineProperty(fiber, 'value', { get: () => proxy });
  complete(fiber, () => {
    runComponent(fiber, passiveRender);
  });

  if (owned) fiber.cleanup = instance.mount?.();
  return fiber;
}

function runComponent(fiber: Fiber, passive: boolean) {
  const instance = fiber.instance!;
  const content = instance.render;

  attempt(fiber, passive, () =>
    enter(fiber.scope!, () => content.call(fiber.value, instance.props))
  );
}

function mountCollection(value: has.List<unknown> | has.Pool<unknown> | map.Managed<unknown, unknown>, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const fiber = range('collection', parent, before, context);
  fiber.source = value;
  fiber.value = value;
  fiber.boundary = boundary;
  fiber.appearance = appearance;
  fiber.scope = makeScope('collection', context, (passive) => runCollection(fiber, passive));

  let first = true;
  fiber.release = watch(value, (current) => {
    fiber.value = current;
    if (!first && fiber.scope?.active) schedule(fiber.scope);
    first = false;
  }, undefined, transition);

  return complete(fiber, () => {
    runCollection(fiber, passiveRender);
  });
}

function runCollection(fiber: Fiber, passive: boolean) {
  attempt(fiber, passive, () => {
    const value = fiber.value as Iterable<unknown>;
    return value instanceof map.Managed ? [...value.values()] : [...value];
  });
}

function mountProvider(value: VNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, inherited?: Boundary, appearance?: Appearance) {
  const fiber = range('provider', parent, before, context);
  const childContext = new Context(context);

  fiber.key = value.key;
  fiber.type = Provider;
  fiber.props = value.props;
  fiber.appearance = appearance;
  fiber.childContext = childContext;
  const commit = provide(childContext, value.props as any);

  const boundary = value.props.fallback !== undefined
    ? { fallback: () => fiber.props!.fallback, owner: fiber, parent: inherited }
    : inherited;

  fiber.boundary = boundary;
  if (boundary !== inherited) fiber.ownBoundary = boundary;
  complete(fiber, () => {
    reconcile(fiber, value.props.children, childContext, boundary, appearance);
  });
  commit();

  return fiber;
}

function mountPortal(value: VNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const marker = document.createComment('portal');
  const container = value.props.container as Container;
  const portalStart = document.createComment('portal-root');
  const portalEnd = document.createComment('/portal-root');

  parent.insertBefore(marker, before);
  container.append(portalStart, portalEnd);

  const output: Fiber = {
    kind: 'portal',
    key: value.key,
    type: PORTAL,
    props: value.props,
    context,
    boundary,
    appearance,
    start: marker,
    end: marker,
    children: [],
    portalContainer: container,
    portalStart,
    portalEnd
  };

  return complete(output, () => {
    reconcilePortal(output, value.props.children, context, boundary, appearance);
  });
}

function mountElement(value: VNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const tag = value.type as string;
  let host = parent;

  for (let owner = stashes.get(host); owner; owner = stashes.get(host))
    host = owner.end.parentNode!;

  const namespace = tag == 'svg' || host instanceof SVGElement && host.localName != 'foreignObject' ? SVG : undefined;
  const element = namespace
    ? document.createElementNS(SVG, tag)
    : document.createElement(tag);
  const fiber: Fiber = {
    kind: 'element',
    key: value.key,
    type: tag,
    props: {},
    context,
    boundary,
    start: element,
    end: element,
    children: [],
    events: new Map()
  };

  parent.insertBefore(element, before);
  return complete(fiber, () => {
    patchProps(fiber, value.props, appearance);
  });
}

function pass<T>(work: () => T): T {
  depth++;

  try {
    return work();
  } finally {
    if (!--depth) settle();
  }
}

function attempt(fiber: Fiber, passive: boolean, render: () => RenderNode) {
  const previous = passiveRender;
  passiveRender ||= passive;

  try {
    return pass(() => {
      try {
        const output = consume(fiber, render);
        reconcile(fiber, output, fiber.scope!.childContext, fiber.boundary, renderedAppearance(fiber));
        unwait(fiber);
        fiber.retried = undefined;
        return true;
      } catch (thrown) {
        suspend(fiber, thrown, passive);
        return false;
      }
    });
  } finally {
    passiveRender = previous;
  }
}

function observe(props: Record<string, any>) {
  if (!('style' in props)) return props;

  let output = observed.get(props);

  if (!output) {
    const { style } = props;
    let handle: Style;
    let resolved = false;

    output = Object.defineProperty({ ...props }, 'style', {
      enumerable: true,
      get() {
        if (rendering === output) touched = true;
        if (!resolved) {
          handle = door(style);
          resolved = true;
        }
        return handle;
      }
    });
    observed.set(props, output);
  }

  return output;
}

function door(value: Style) {
  const collected: Collected = { classes: [], declarations: {}, tokens: [] };
  const { classes, declarations, tokens } = collected;

  collect(value, collected, 1);

  if (!classes.length && !tokens.length && !Object.keys(declarations).length) return undefined;

  const key = Object.freeze({});

  tickets.set(key, { classes, tokens });
  return Object.freeze({ ...declarations, [Symbol('style')]: key });
}

function consume(fiber: Fiber, render: () => RenderNode) {
  const previous = rendering;
  const read = touched;

  rendering = fiber.props;
  touched = false;

  try {
    const output = render();
    fiber.consumed = touched;
    return output;
  } finally {
    rendering = previous;
    touched = read;
  }
}

function wait(fiber: Fiber, boundary: Boundary) {
  if (fiber.waitingOn !== boundary) unwait(fiber);

  fiber.waitingOn = boundary;
  (boundary.waiting ||= new Set()).add(fiber);
  dirty.add(boundary);
}

function unwait(fiber: Fiber) {
  const boundary = fiber.waitingOn;

  if (!boundary) return;

  fiber.waitingOn = undefined;
  boundary.waiting!.delete(fiber);
  if (!boundary.owner!.dead) dirty.add(boundary);
}

function settle() {
  if (settling) return;
  settling = true;

  try {
    for (const boundary of dirty) {
      dirty.delete(boundary);

      const owner = boundary.owner!;
      const waiting = boundary.waiting!.size > 0;

      if (!owner.dead && waiting != !!owner.stash)
        waiting ? hide(owner, boundary) : reveal(owner);
    }
  } finally {
    settling = false;
  }
}

function hide(owner: Fiber, boundary: Boundary) {
  const stash = document.createDocumentFragment();

  for (const child of owner.children) move(child, stash, null);

  owner.portals = portals(owner, []).map((portal) => {
    const content = document.createDocumentFragment();
    moveRange(portal.portalStart!, portal.portalEnd!, content);
    return [portal, content];
  });

  stashes.set(stash, owner);

  const context = owner.childContext!;
  const placeholder = range('fragment', owner.end.parentNode!, owner.end, context);

  owner.stash = stash;
  owner.placeholder = placeholder;
  reconcile(placeholder, boundary.fallback(), context, boundary.parent);
}

function reveal(owner: Fiber) {
  unmountFiber(owner.placeholder!);
  owner.end.parentNode!.insertBefore(owner.stash!, owner.end);

  for (const [portal, content] of owner.portals!)
    if (!portal.dead) portal.portalContainer!.append(content);

  owner.portals = undefined;
  owner.placeholder = undefined;
  owner.stash = undefined;
}

function portals(fiber: Fiber, found: Fiber[]) {
  for (const child of fiber.children) {
    if (child.kind == 'portal') found.push(child);
    portals(child, found);
  }

  return found;
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

function suspend(fiber: Fiber, thrown: unknown, passive: boolean) {
  const boundary = fiber.boundary;

  if (isThenable(thrown)) {
    if (!boundary) throw thrown;
    if (passive && !fiber.children.length && depth > 1) throw thrown;
    if (!passive) wait(fiber, boundary);

    const scope = fiber.scope!;
    let held = scope.holds;

    scope.holds = undefined;

    const clear = () => {
      fiber.suspended!.delete(clear);
      release(held);
      held = undefined;
    };

    (fiber.suspended ||= new Set()).add(clear);

    const resume = (retry: () => void) => {
      fiber.suspended!.delete(clear);
      if (!scope.active) return clear();
      if (held) (scope.holds ||= []).push(...held);
      held = undefined;
      retry();
    };

    thrown.then(
      () => resume(() => passive ? transition(() => schedule(scope)) : schedule(scope)),
      (error) => resume(() => pass(() => recover(fiber, error)))
    );
    return;
  }

  recover(fiber, thrown);
}

function recover(fiber: Fiber, thrown: unknown, boundary = fiber.boundary) {
  const error = thrown instanceof Error ? thrown : new Error(String(thrown));

  while (boundary && !boundary.catch) boundary = boundary.parent;

  if (!boundary) throw error;

  const handler = boundary;

  wait(fiber, handler);

  Promise.resolve(handler.catch!(error)).then(
    () => {
      if (!fiber.scope!.active || fiber.retried) return;
      fiber.retried = true;
      schedule(fiber.scope!);
    },
    (next) => {
      if (fiber.scope!.active) pass(() => recover(fiber, next, handler.parent));
    }
  );
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return !!value && typeof (value as PromiseLike<unknown>).then == 'function';
}

function reconcile(fiber: Fiber, value: RenderNode, context: Context, boundary?: Boundary, appearance?: Appearance) {
  if (fiber.stash) reconcileChildren(fiber, fiber.stash, null, value, context, boundary, appearance);
  else reconcileChildren(fiber, fiber.end.parentNode!, fiber.end, value, context, boundary, appearance);
}

function reconcilePortal(fiber: Fiber, value: RenderNode, context: Context, boundary?: Boundary, appearance?: Appearance) {
  reconcileChildren(fiber, fiber.portalEnd!.parentNode!, fiber.portalEnd!, value, context, boundary, appearance);
}

function reconcileChildren(owner: Fiber, parent: globalThis.Node, before: globalThis.Node | null, value: RenderNode, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const values = childrenOf(value);
  const old = owner.children;
  const keyed = new Map<Key, Fiber>();
  const used = new Set<Fiber>();
  const next: Fiber[] = [];

  for (const child of old)
    if (child.key !== null && child.key !== undefined) keyed.set(child.key, child);

  try {
    for (let index = 0; index < values.length; index++) {
      const value = values[index];
      const key = keyOf(value);
      let child = key !== null && key !== undefined
        ? keyed.get(key)
        : old[index]?.key == null
          ? old[index]
          : undefined;

      if (child && used.has(child)) child = undefined;
      if (child) used.add(child);

      next.push(patch(child, value, parent, before, context, boundary, appearance));
    }
  } catch (error) {
    owner.children = [...next, ...old.filter((child) => !child.dead && !next.includes(child))];
    throw error;
  }

  for (const child of old)
    if (!used.has(child)) unmountFiber(child);

  let anchor = before;
  for (let index = next.length - 1; index >= 0; index--) {
    move(next[index], parent, anchor);
    anchor = next[index].start;
  }

  owner.children = next;
}

function patch(old: Fiber | undefined, value: RenderNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary, appearance?: Appearance): Fiber {
  if (!old || !compatible(old, value)) {
    const next = mount(value, parent, old?.start || before, context, boundary, appearance);
    if (old) unmountFiber(old);
    return next;
  }

  if (old.ownBoundary) old.ownBoundary.parent = boundary;
  old.boundary = old.ownBoundary || boundary;
  if (old.kind == 'collection') {
    if (old.appearance !== appearance) {
      old.appearance = appearance;
      runCollection(old, passiveRender);
    }
    return old;
  }

  if (old.kind == 'text') {
    const next = String(value);
    if (old.start.nodeValue !== next) old.start.nodeValue = next;
    old.value = value;
  } else if (old.kind == 'element') {
    patchProps(old, (value as VNode).props, appearance);
  } else if (old.kind == 'fragment') {
    old.context = context;
    old.appearance = appearance;
    reconcile(old, (value as VNode).props.children, context, old.boundary, appearance);
  } else if (old.kind == 'function') {
    const vnode = value as VNode;
    const resolved = componentProps(vnode.type, vnode.props, appearance, parent, old.appearanceRoute);
    old.appearance = resolved.appearance;
    old.appearanceRoute = resolved.route;
    old.props = observe(resolved.props);
    rerun(old, () => runFunction(old, passiveRender));
  } else if (old.kind == 'component') {
    const resolved = isVNode(value)
      ? componentProps(value.type, value.props, appearance, parent, old.appearanceRoute)
      : { appearance, props: old.instance!.props, route: old.appearanceRoute };
    old.appearance = resolved.appearance;
    old.appearanceRoute = resolved.route;
    const props = isVNode(value) ? observe(resolved.props) : resolved.props;
    if (isVNode(value) && props !== old.instance!.props) {
      if (passiveRender) old.applied = true;
      (old.instance as any).props = props;
    }
    old.props = props as Record<string, any>;
    rerun(old, () => runComponent(old, passiveRender));
  } else if (old.kind == 'provider') {
    old.appearance = appearance;
    old.props = (value as VNode).props;
    const commit = provide(old.childContext!, old.props as any);
    reconcile(old, old.props!.children, old.childContext!, old.boundary, appearance);
    commit();
  } else {
    old.appearance = appearance;
    const vnode = value as VNode;
    old.props = vnode.props;
    reconcilePortal(old, vnode.props.children, context, old.boundary, appearance);
  }

  return old;
}

function rerun(fiber: Fiber, run: () => void) {
  dequeue(fiber.scope!);
  run();
  absorb(fiber.scope!);
}

function compatible(fiber: Fiber, value: RenderNode) {
  if (fiber.kind == 'text') return ['string', 'number', 'bigint'].includes(typeof value);
  if (value instanceof Component) return fiber.kind == 'component' && fiber.instance === value;
  if (value instanceof has.List || value instanceof has.Pool || value instanceof map.Managed)
    return fiber.kind == 'collection' && fiber.source === value;
  if (!isVNode(value)) return false;
  if (fiber.key !== value.key || fiber.type !== value.type) return false;
  if (fiber.kind == 'portal') return fiber.portalContainer === value.props.container;
  return true;
}

function keyOf(value: RenderNode): Key {
  if (value instanceof Component) return value.key;
  return isVNode(value) ? value.key : undefined;
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

function patchProps(fiber: Fiber, next: Record<string, any>, appearance?: Appearance) {
  const element = fiber.start as Element;
  const previous = fiber.props!;
  const raw = 'dangerouslySetInnerHTML' in next;
  const resolved = appearance?.context?.resolve(
    fiber.appearanceRoute,
    fiber.type as string,
    next,
    element.ownerDocument
  ) || {};

  fiber.appearanceRoute = resolved.route;

  if (raw) {
    for (let index = fiber.children.length - 1; index >= 0; index--)
      unmountFiber(fiber.children[index]);
    fiber.children = [];
  }

  for (const key of Object.keys({ ...previous, ...next })) {
    if (key.startsWith('_') || key == 'children' || key == 'class' || key == 'className' || key == 'key' || key == 'ref' || key == 'style' || CONTROLS.includes(key)) continue;
    if (previous[key] === next[key]) continue;
    patchProp(fiber, element, key, previous[key], next[key]);
  }

  const claimed = claim(element, appearance, resolved.appearance, next.class, next.style);

  applyClaim(element, fiber.claimed, claimed);
  fiber.claimed = claimed;
  fiber.props = next;
  fiber.appearance = appearance;

  if (!raw) {
    reconcileChildren(
      fiber,
      element,
      null,
      next.children,
      fiber.context,
      fiber.boundary,
      claimed.context ? { context: claimed.context, entries: [] } : undefined
    );
  }

  for (const key of CONTROLS) {
    const value = next[key];
    const live = (element as any)[key];
    const differs = value == null || !(key in element)
      ? previous[key] !== value
      : key == 'value' ? String(live) !== String(value) : live !== value;

    if (differs) patchProp(fiber, element, key, previous[key], value);
  }

  if (previous.ref !== next.ref) patchProp(fiber, element, 'ref', previous.ref, next.ref);
}

function patchProp(fiber: Fiber, element: Element, key: string, previous: any, next: any) {
  if (key == 'ref') {
    applyRef(previous, null);
    applyRef(next, element);
    return;
  }

  if (key == 'dangerouslySetInnerHTML') {
    element.innerHTML = next?.__html || '';
    return;
  }

  if (/^on[A-Z]/.test(key)) {
    const capture = key.endsWith('Capture');
    const name = (capture ? key.slice(2, -7) : key.slice(2)).toLowerCase();
    const id = `${name}:${capture}`;
    const current = fiber.events!.get(id);

    if (current) element.removeEventListener(name, current, capture);
    if (typeof next == 'function') {
      fiber.events!.set(id, next);
      element.addEventListener(name, next, capture);
    } else fiber.events!.delete(id);
    return;
  }

  const name = key == 'htmlFor' ? 'for' : key;

  if (key.startsWith('aria-') && next != null) {
    element.setAttribute(name, String(next));
    return;
  }

  if (next === null || next === undefined || next === false) {
    if (key in element && typeof (element as any)[key] != 'function')
      try {
        const current = (element as any)[key];
        (element as any)[key] = typeof current == 'boolean'
          ? false
          : typeof current == 'number'
            ? 0
            : '';
      } catch {}
    element.removeAttribute(name);
    return;
  }

  if (key in element && !key.startsWith('data-') && element.namespaceURI !== SVG)
    try {
      (element as any)[key] = next;
      return;
    } catch {}

  element.setAttribute(name, next === true ? '' : String(next));
}

type Style = string | Record<string, unknown> | false | null | undefined | readonly Style[];

function applyClaim(element: Element, before: Claim | undefined, after: Claim) {
  const previous = before || { className: '', declarations: {} };

  if (previous.className !== after.className) {
    if (after.className) element.setAttribute('class', after.className);
    else element.removeAttribute('class');
  }

  const declaration = (element as HTMLElement).style as any;
  for (const key of Object.keys({ ...previous.declarations, ...after.declarations })) {
    const value = after.declarations[key];
    if (key.startsWith('--')) {
      declaration.setProperty(key, value == null ? '' : String(value));
      continue;
    }
    if (typeof value == 'number') declaration[key] = '';
    declaration[key] = value == null ? '' : value;
    if (typeof value == 'number' && value !== 0 && !declaration[key])
      declaration[key] = `${value}px`;
  }
}

function claim(
  element: Element,
  appearance: Appearance | undefined,
  resolved: ResolvedAppearance | undefined,
  className: unknown,
  value: Style
): Claim {
  const collected: Collected = { classes: [], declarations: {}, tokens: [] };
  const entries = appearance?.entries || [];
  let context = appearance?.context;

  if (resolved) collect(createAppearanceToken(resolved), collected, 0);
  appendClasses(collected.classes, className);
  collect(value, collected, 0);

  for (let index = entries.length - 1; index >= 0; index--)
    collect(entries[index].style, collected, entries[index].hops);

  for (const { appearance, doors } of collected.tokens) {
    for (const block of appearance.blocks || [])
      collected.classes.push(emitClass(block, doors, element.ownerDocument));
    if (appearance.classes) collected.classes.push(...appearance.classes);
    if (appearance.context) context = appearance.context;
  }

  return {
    className: [...new Set(collected.classes)].join(' '),
    context,
    declarations: collected.declarations
  };
}

function renderedAppearance(fiber: Fiber): Appearance | undefined {
  if (fiber.kind != 'component' && fiber.kind != 'function') return fiber.appearance;

  const style = fiber.props?.style as Style;
  const entries = (fiber.appearance?.entries || []).map(({ hops, style }) => ({ hops: hops + 1, style }));
  const context = enterAppearance(fiber.appearance?.context, fiber.type as Function);

  if (style && !fiber.consumed && !(fiber.instance && 'style' in fiber.instance)) entries.push({ hops: 0, style });

  return entries.length || context ? { context, entries } : undefined;
}

function collect(value: Style, collected: Collected, doors: number) {
  if (!value) return;

  const token = appearanceToken(value);
  if (token) {
    collected.tokens.push({ appearance: token, doors });
    Object.assign(collected.declarations, token.declarations);
    return;
  }

  if (typeof value == 'string') {
    appendClasses(collected.classes, value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => collect(entry, collected, doors));
    return;
  }

  for (const symbol of Object.getOwnPropertySymbols(value)) {
    const ticket = tickets.get((value as Record<symbol, object>)[symbol]);
    if (!ticket) continue;

    collected.classes.push(...ticket.classes);
    for (const carried of ticket.tokens)
      collected.tokens.push({ appearance: carried.appearance, doors: carried.doors + doors });
  }

  for (const key of Object.keys(value)) collected.declarations[key] = (value as Record<string, unknown>)[key];
}

function appendClasses(classes: string[], value: unknown) {
  if (typeof value == 'string') classes.push(...value.split(/\s+/).filter(Boolean));
}

function applyRef(ref: unknown, value: Element | null) {
  if (typeof ref == 'function') ref(value);
  else if (ref && typeof ref == 'object' && 'current' in ref) (ref as { current: Element | null }).current = value;
}

function unmountFiber(fiber: Fiber) {
  fiber.dead = true;
  unwait(fiber);

  for (let index = fiber.children.length - 1; index >= 0; index--)
    unmountFiber(fiber.children[index]);

  if (fiber.placeholder) unmountFiber(fiber.placeholder);

  fiber.suspended?.forEach((clear) => clear());
  if (fiber.scope) dispose(fiber.scope);
  fiber.release?.();

  if (fiber.kind == 'element') {
    applyRef(fiber.props?.ref, null);
    for (const [id, listener] of fiber.events!) {
      const [name, capture] = id.split(':');
      (fiber.start as Element).removeEventListener(name, listener, capture === 'true');
    }
  }

  if (fiber.kind == 'component') {
    if (typeof fiber.cleanup == 'function') fiber.cleanup();
    fiber.childContext?.pop();
    if (fiber.owned && !fiber.instance!.get(null)) fiber.instance!.set(null);
  } else if (fiber.kind == 'provider') {
    fiber.childContext?.pop();
  } else if (fiber.kind == 'portal') {
    (fiber.portalStart as ChildNode).remove();
    (fiber.portalEnd as ChildNode).remove();
  }

  removeRange(fiber.start, fiber.end);
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

export { render };
export type { Container };
