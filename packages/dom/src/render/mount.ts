import { Component, Context, State, unbind } from '@expressive/mvc';
import { has, map } from '@expressive/mvc';
import { watch } from '@expressive/mvc/observable';
import { Fragment } from '@expressive/mvc/jsx-runtime';

import { resolve } from '../node/loader';
import { PORTAL, isVNode } from '../node/vnode';
import type { Key, Node as RenderNode, VNode } from '../node/vnode';
import { createAppearanceToken } from '../style/protocol';
import { call, commit, dispose, enter } from './adapter';
import { inserted } from './commits';
import { SVG, patchProps, applyRef } from './element';
import { range, makeScope, park, removeRange } from './fiber';
import type { Container, Boundary, Renderable, Placement, Fiber, Appearance } from './fiber';
import { latest, track, untrack } from './hot';
import { reconcile, reconcilePortal, renderable, isCollection } from './reconcile';
import { attempt, focusing, passiveRender } from './render';
import { schedule, transition } from './scheduler';
import { observe, consume } from './style';
import { stashes, holding, unwait, isThenable } from './suspense';

function complete<T extends Fiber>(fiber: T, work: () => void): T {
  try {
    work();
  } catch (error) {
    if (holding && error === holding.thrown) {
      park(fiber);
      holding.fiber = fiber;
    } else unmountFiber(fiber);

    throw error;
  }

  return fiber;
}

function componentProps(
  type: unknown,
  props: Record<string, any>,
  appearance: Appearance | undefined
) {
  const context = appearance?.context;
  if (!context || typeof type != 'function') return { appearance, props };

  const value = context.resolve(props);
  const entries = appearance!.entries;

  if (!value) return { appearance: { entries }, props };

  return {
    appearance: {
      context: value.context,
      entries
    },
    props: { ...props, style: [createAppearanceToken(value), props.style] }
  };
}

function mount(value: RenderNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary, appearance?: Appearance): Fiber {
  if (typeof value == 'string' || typeof value == 'number' || typeof value == 'bigint') {
    const text = document.createTextNode(String(value));
    parent.insertBefore(text, before);
    return { kind: 'text', value, context, start: text, end: text, children: [] };
  }

  if (renderable(value)) return mountComponent(value, parent, before, context, boundary, appearance);
  if (isCollection(value))
    return mountCollection(value, parent, before, context, boundary, appearance);

  if (!isVNode(value)) throw new TypeError(`Cannot render ${String(value)}.`);

  if (value.type === Fragment) return mountFragment(value, parent, before, context, boundary, appearance);
  if (value.type === PORTAL) return mountPortal(value, parent, before, context, boundary, appearance);
  if (typeof value.type == 'string') return mountElement(value, parent, before, context, boundary, appearance);
  if (typeof value.type != 'function')
    throw new Error(`Cannot render ${String(value.type)}.`);

  if (value.type.prototype instanceof State)
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
  const resolved = componentProps(value.type, value.props, appearance);
  fiber.key = value.key;
  fiber.type = value.type;
  fiber.props = observe(resolved.props);
  fiber.boundary = boundary;
  fiber.appearance = resolved.appearance;
  fiber.scope = makeScope('function', context, (passive) => runFunction(fiber, passive));
  fiber.render = () => enter(fiber.scope!, () => {
    const type = latest(fiber.type as Function);
    return resolve(type, fiber.props!, () => call(type, fiber.props));
  });
  track(fiber.type as Function, fiber.scope);
  probing(fiber);

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
  const resolved = componentProps(value.type, value.props, appearance);
  const Type = value.type as new (...args: unknown[]) => Renderable;
  const props = observe(resolved.props);
  const instance: Renderable = new Type(props,
    Type.prototype instanceof Component ? undefined : () => props.is?.(instance)
  );

  return mountComponent(instance, parent, before, context, boundary, resolved.appearance, true, value.key, props);
}

function runFunction(fiber: Fiber, passive: boolean) {
  const result = attempt(fiber, passive, fiber.render!);

  if (result === true) inserted(fiber, () => commit(fiber.scope!));
  else return result;
}

function probing(fiber: Fiber) {
  const scope = fiber.scope!;

  scope.empty = () => !fiber.children.length;
  scope.probe = () => {
    try {
      scope.probed = { output: consume(fiber, fiber.render!) };
    } catch (thrown) {
      if (isThenable(thrown)) return thrown;
    }
  };
}

function mountComponent(
  instance: Renderable,
  parent: globalThis.Node,
  before: globalThis.Node | null,
  context: Context,
  inherited?: Boundary,
  appearance?: Appearance,
  owned = false,
  key?: Key,
  props = instance.props
) {
  const fiber = range('component', parent, before, context);
  const childContext = context.push(instance);
  const element = (owned ? props : {}) as Placement;
  const fallback = element.fallback !== undefined ? element.fallback : instance.fallback;
  const ownBoundary: Boundary | undefined = fallback !== undefined && fallback !== false || element.catch || instance.catch
    ? {
        catch: element.catch || instance.catch ? (error) => {
          const handler = owned && (fiber.props as Placement).catch;
          return (handler || instance.catch)!.call(instance, error, instance);
        } : undefined,
        fallback: () => {
          const placed = owned ? (fiber.props as Placement).fallback : undefined;
          return placed !== undefined ? placed : instance.fallback;
        },
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
  fiber.props = props;
  fiber.owned = owned;
  fiber.appearance = appearance;
  fiber.scope = makeScope('component', childContext, (passive) => runComponent(fiber, passive));
  fiber.render = () => enter(fiber.scope!, () => {
    const { render } = fiber.value as Renderable;
    return render ? unbind(render).call(fiber.value, fiber.props) : fiber.props!.children ?? null;
  });
  probing(fiber);

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
  try {
    complete(fiber, () => {
      runComponent(fiber, passiveRender);
    });
  } finally {
    if (owned && !fiber.dead) inserted(fiber, () => (fiber.cleanup = instance.mount?.()));
  }

  return fiber;
}

function runComponent(fiber: Fiber, passive: boolean) {
  const result = attempt(fiber, passive, fiber.render!);

  if (result !== true) return result;
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

function mountPortal(value: VNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const marker = document.createComment('portal');
  const container = target(value.props.into, parent);
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

function target(into: unknown, parent: globalThis.Node): Container {
  if (typeof into != 'string') return into as Container;

  const root = parent.getRootNode();
  const found = [...document.querySelectorAll(into)];

  if (root instanceof DocumentFragment) found.push(...root.querySelectorAll(into));

  if (found.length != 1)
    throw new Error(`Portal target "${into}" ${found.length ? 'is ambiguous' : 'was not found'}.`);

  return found[0];
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
  complete(fiber, () => {
    patchProps(fiber, value.props, appearance);
  });

  if (value.props.autofocus || value.props.autoFocus) focusing.push(element);
  return fiber;
}

function unmountFiber(fiber: Fiber) {
  fiber.dead = true;
  unwait(fiber);

  for (let index = fiber.children.length - 1; index >= 0; index--)
    unmountFiber(fiber.children[index]);

  if (fiber.placeholder) unmountFiber(fiber.placeholder);

  fiber.suspended?.forEach((clear) => clear());
  if (fiber.kind == 'function') untrack(fiber.type as Function, fiber.scope!);
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
  } else if (fiber.kind == 'portal') {
    (fiber.portalStart as ChildNode).remove();
    (fiber.portalEnd as ChildNode).remove();
  }

  removeRange(fiber.start, fiber.end);
}

export { componentProps, mount, runCollection, runComponent, runFunction, unmountFiber };
