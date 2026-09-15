import { Component, Context, State } from '@expressive/mvc';
import { has, map } from '@expressive/mvc';
import { watch } from '@expressive/mvc/observable';
import { Fragment } from '@expressive/mvc/runtime';

import { commit, dispose, enter } from './adapter';
import type { Scope } from './adapter';
import { Provider, provide } from './context';
import { release, schedule, transition } from './scheduler';
import { PORTAL, childrenOf, isVNode } from './vnode';
import type { Key, Node as RenderNode, VNode } from './vnode';

type Container = Element | DocumentFragment;
type Kind = 'collection' | 'component' | 'element' | 'fragment' | 'function' | 'portal' | 'provider' | 'text';

interface Boundary {
  catch?: (error: Error) => Promise<void> | void;
  fallback: () => RenderNode;
  parent?: Boundary;
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
  parent: globalThis.Node;
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
  fresh?: State[];
  mounts?: (() => void)[];
  ignore?: boolean;
}

const roots = new WeakMap<Container, () => void>();
const SVG = 'http://www.w3.org/2000/svg';
let passiveRender = false;

function render(node: RenderNode, container: Container): () => void {
  roots.get(container)?.();
  container.replaceChildren();

  const context = new Context(Context.root);
  const fiber = range('fragment', container, null, context);

  try {
    reconcile(fiber, node, context, undefined);
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

  return { kind, context, parent, start, end, children: [] };
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

function mount(value: RenderNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary): Fiber {
  if (typeof value == 'string' || typeof value == 'number' || typeof value == 'bigint') {
    const text = document.createTextNode(String(value));
    parent.insertBefore(text, before);
    return { kind: 'text', value, context, parent, start: text, end: text, children: [] };
  }

  if (value instanceof Component) return mountComponent(value, parent, before, context, boundary);
  if (value instanceof has.List || value instanceof has.Pool || value instanceof map.Managed)
    return mountCollection(value, parent, before, context, boundary);

  if (!isVNode(value)) throw new TypeError(`Cannot render ${String(value)}.`);

  if (value.type === Fragment) return mountFragment(value, parent, before, context, boundary);
  if (value.type === PORTAL) return mountPortal(value, parent, before, context, boundary);
  if (value.type === Provider) return mountProvider(value, parent, before, context, boundary);
  if (typeof value.type == 'string') return mountElement(value, parent, before, context, boundary);
  if (typeof value.type != 'function')
    throw new Error(`Cannot render ${String(value.type)}.`);

  if (value.type.prototype instanceof Component)
    return mountComponent(new (value.type as new (props: any) => Component)(value.props), parent, before, context, boundary, true, value.key);

  return mountFunction(value, parent, before, context, boundary);
}

function mountFragment(value: VNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary) {
  const fiber = range('fragment', parent, before, context);
  fiber.key = value.key;
  fiber.type = Fragment;

  return complete(fiber, () => {
    reconcile(fiber, value.props.children, context, boundary);
  });
}

function mountFunction(value: VNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary) {
  const fiber = range('function', parent, before, context);
  fiber.key = value.key;
  fiber.type = value.type;
  fiber.props = value.props;
  fiber.boundary = boundary;
  fiber.scope = makeScope('function', context, (passive) => runFunction(fiber, passive));

  return complete(fiber, () => {
    runFunction(fiber, passiveRender);
  });
}

function runFunction(fiber: Fiber, passive: boolean) {
  attempt(fiber, passive, () =>
    enter(fiber.scope!, () => (fiber.type as Function)(fiber.props))
  );
  commit(fiber.scope!);
}

function mountComponent(
  instance: Component,
  parent: globalThis.Node,
  before: globalThis.Node | null,
  context: Context,
  inherited?: Boundary,
  owned = false,
  key?: Key
) {
  const fiber = range('component', parent, before, context);
  const childContext = context.push(instance);
  const ownBoundary: Boundary | undefined = instance.fallback !== false || instance.catch
    ? {
        catch: instance.catch?.bind(instance),
        fallback: () => instance.fallback,
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
  fiber.scope = makeScope('component', childContext, (passive) => runComponent(fiber, passive));

  let first = true;
  let proxy = instance;
  fiber.release = watch(instance, (current) => {
    proxy = current;

    if (!first && fiber.scope?.active) {
      if (fiber.ignore) fiber.ignore = false;
      else schedule(fiber.scope);
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

function mountCollection(value: has.List<unknown> | has.Pool<unknown> | map.Managed<unknown, unknown>, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary) {
  const fiber = range('collection', parent, before, context);
  fiber.source = value;
  fiber.value = value;
  fiber.boundary = boundary;
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

function mountProvider(value: VNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, inherited?: Boundary) {
  const fiber = range('provider', parent, before, context);
  const childContext = new Context(context);

  fiber.key = value.key;
  fiber.type = Provider;
  fiber.props = value.props;
  fiber.childContext = childContext;
  fiber.fresh = provide(childContext, value.props as any);
  fiber.mounts = [];

  const boundary = value.props.fallback !== undefined
    ? { fallback: () => fiber.props!.fallback, parent: inherited }
    : inherited;

  fiber.boundary = boundary;
  if (boundary !== inherited) fiber.ownBoundary = boundary;
  complete(fiber, () => {
    reconcile(fiber, value.props.children, childContext, boundary);
  });

  for (const state of fiber.fresh) {
    const cleanup = (state as State & { mount?(): (() => void) | void }).mount?.();
    if (typeof cleanup == 'function') fiber.mounts.push(cleanup);
  }

  return fiber;
}

function mountPortal(value: VNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary) {
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
    parent,
    start: marker,
    end: marker,
    children: [],
    portalContainer: container,
    portalStart,
    portalEnd
  };

  return complete(output, () => {
    reconcilePortal(output, value.props.children, context, boundary);
  });
}

function mountElement(value: VNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary) {
  const tag = value.type as string;
  const namespace = parent instanceof SVGElement || tag == 'svg' ? SVG : undefined;
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
    parent,
    start: element,
    end: element,
    children: [],
    events: new Map()
  };

  parent.insertBefore(element, before);
  return complete(fiber, () => {
    patchProps(fiber, value.props);
  });
}

function attempt(fiber: Fiber, passive: boolean, render: () => RenderNode) {
  const previous = passiveRender;
  passiveRender ||= passive;

  try {
    reconcile(fiber, render(), fiber.scope!.childContext, fiber.boundary);
  } catch (thrown) {
    suspend(fiber, thrown, passive);
  } finally {
    passiveRender = previous;
  }
}

function suspend(fiber: Fiber, thrown: unknown, passive: boolean) {
  const boundary = fiber.boundary;

  if (thrown instanceof Promise) {
    if (!boundary) throw thrown;
    if (passive && !fiber.children.length) throw thrown;
    if (!passive)
      reconcile(fiber, boundary.fallback(), fiber.context, boundary.parent);

    const scope = fiber.scope!;
    const held = scope.holds;

    scope.holds = undefined;

    const resume = (retry: () => void) => {
      if (!scope.active) return release(held);
      retry();
      if (held) scope.holds = held;
    };

    thrown.then(
      () => resume(() => schedule(scope)),
      (error) => resume(() => recover(fiber, error))
    );
    return;
  }

  recover(fiber, thrown);
}

function recover(fiber: Fiber, thrown: unknown) {
  const boundary = fiber.boundary;
  const error = thrown instanceof Error ? thrown : new Error(String(thrown));

  if (!boundary?.catch) {
    if (boundary?.parent) {
      fiber.boundary = boundary.parent;
      recover(fiber, error);
      return;
    }

    throw error;
  }

  reconcile(fiber, boundary.fallback(), fiber.context, boundary.parent);

  Promise.resolve(boundary.catch(error)).then(
    () => {
      if (fiber.scope!.active) schedule(fiber.scope!);
    },
    (next) => {
      if (!fiber.scope!.active) return;
      fiber.boundary = boundary.parent;
      recover(fiber, next);
    }
  );
}

function reconcile(fiber: Fiber, value: RenderNode, context: Context, boundary?: Boundary) {
  reconcileChildren(fiber, fiber.parent, fiber.end, value, context, boundary);
}

function reconcilePortal(fiber: Fiber, value: RenderNode, context: Context, boundary?: Boundary) {
  reconcileChildren(fiber, fiber.portalContainer!, fiber.portalEnd!, value, context, boundary);
}

function reconcileChildren(owner: Fiber, parent: globalThis.Node, before: globalThis.Node | null, value: RenderNode, context: Context, boundary?: Boundary) {
  const values = childrenOf(value);
  const old = owner.children;
  const keyed = new Map<Key, Fiber>();
  const used = new Set<Fiber>();
  const next: Fiber[] = [];

  for (const child of old)
    if (child.key !== null && child.key !== undefined) keyed.set(child.key, child);

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

    next.push(patch(child, value, parent, before, context, boundary));
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

function patch(old: Fiber | undefined, value: RenderNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary): Fiber {
  if (!old || !compatible(old, value)) {
    const next = mount(value, parent, old?.start || before, context, boundary);
    if (old) unmountFiber(old);
    return next;
  }

  if (old.ownBoundary) old.ownBoundary.parent = boundary;
  old.boundary = old.ownBoundary || boundary;

  if (old.kind == 'collection') return old;

  if (old.kind == 'text') {
    const next = String(value);
    if (old.start.nodeValue !== next) old.start.nodeValue = next;
    old.value = value;
  } else if (old.kind == 'element') {
    patchProps(old, (value as VNode).props);
  } else if (old.kind == 'fragment') {
    old.context = context;
    reconcile(old, (value as VNode).props.children, context, old.boundary);
  } else if (old.kind == 'function') {
    old.props = (value as VNode).props;
    runFunction(old, passiveRender);
  } else if (old.kind == 'component') {
    const props = isVNode(value) ? value.props : old.instance!.props;
    if (isVNode(value) && props !== old.instance!.props) {
      old.ignore = true;
      (old.instance as any).props = props;
    }
    old.props = props as Record<string, any>;
    runComponent(old, passiveRender);
  } else if (old.kind == 'provider') {
    old.props = (value as VNode).props;
    provide(old.childContext!, old.props as any);
    reconcile(old, old.props!.children, old.childContext!, old.boundary);
  } else {
    const vnode = value as VNode;
    old.props = vnode.props;
    reconcilePortal(old, vnode.props.children, context, old.boundary);
  }

  return old;
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
  if (fiber.parent === parent && fiber.end.nextSibling === before) return;

  let node: globalThis.Node | null = fiber.start;
  while (node) {
    const next: globalThis.Node | null = node.nextSibling;
    parent.insertBefore(node, before);
    if (node === fiber.end) break;
    node = next;
  }

  fiber.parent = parent;
}

function patchProps(fiber: Fiber, next: Record<string, any>) {
  const element = fiber.start as Element;
  const previous = fiber.props!;

  for (const key of Object.keys({ ...previous, ...next })) {
    if (key == 'children' || key == 'key') continue;
    if (previous[key] === next[key]) continue;
    patchProp(fiber, element, key, previous[key], next[key]);
  }

  fiber.props = next;

  if ('dangerouslySetInnerHTML' in next) {
    for (let index = fiber.children.length - 1; index >= 0; index--)
      unmountFiber(fiber.children[index]);
    fiber.children = [];
  } else {
    reconcileChildren(fiber, element, null, next.children, fiber.context, fiber.boundary);
  }
}

function patchProp(fiber: Fiber, element: Element, key: string, previous: any, next: any) {
  if (key == 'ref') {
    applyRef(previous, null);
    applyRef(next, element);
    return;
  }

  if (key == 'style') {
    patchStyle(element as HTMLElement, previous, next);
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

  const name = key == 'className' ? 'class' : key == 'htmlFor' ? 'for' : key;

  if (next === null || next === undefined || next === false) {
    element.removeAttribute(name);
    if (key in element && typeof (element as any)[key] != 'function')
      try {
        const current = (element as any)[key];
        (element as any)[key] = typeof current == 'boolean'
          ? false
          : typeof current == 'number'
            ? 0
            : '';
      } catch {}
    return;
  }

  if (key in element && !key.startsWith('aria-') && !key.startsWith('data-') && element.namespaceURI !== SVG)
    try {
      (element as any)[key] = next;
      return;
    } catch {}

  element.setAttribute(name, next === true ? '' : String(next));
}

function patchStyle(element: HTMLElement, previous: string | Record<string, unknown> | undefined, next: string | Record<string, unknown> | undefined) {
  if (typeof next == 'string') {
    element.style.cssText = next;
    return;
  }

  if (typeof previous == 'string') element.style.cssText = '';

  const before = typeof previous == 'object' && previous ? previous : {};
  const after = typeof next == 'object' && next ? next : {};

  for (const key of Object.keys({ ...before, ...after })) {
    const value = after[key];
    (element.style as any)[key] = value == null ? '' : typeof value == 'number' && value !== 0 ? `${value}px` : value;
  }
}

function applyRef(ref: unknown, value: Element | null) {
  if (typeof ref == 'function') ref(value);
  else if (ref && typeof ref == 'object' && 'current' in ref) (ref as { current: Element | null }).current = value;
}

function unmountFiber(fiber: Fiber) {
  for (let index = fiber.children.length - 1; index >= 0; index--)
    unmountFiber(fiber.children[index]);

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
    for (let index = fiber.mounts!.length - 1; index >= 0; index--)
      fiber.mounts![index]();
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
