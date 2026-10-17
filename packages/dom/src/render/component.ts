import { Component, Context, Model, unbind } from '@expressive/mvc';
import { watch } from '@expressive/mvc/observable';

import { resolve } from '../node/loader';
import { isVNode } from '../node/vnode';
import type { Key, Node as RenderNode, VNode } from '../node/vnode';
import { componentProps } from '../style/claim';
import type { Appearance } from '../style/claim';
import { call, enter } from './adapter';
import { inserted } from './commits';
import { makeScope, range } from './fiber';
import type { Boundary, Fiber, Placement, Renderable } from './fiber';
import { latest, track, untrack } from './hot';
import { complete } from './mount';
import { attempt, passiveRender } from './render';
import { claim as dequeue, schedule, settle as absorb, transition } from './scheduler';
import { consume, observe } from './style';
import { isThenable } from './suspense';

function mountFunction(value: VNode, parent: globalThis.Node, before: globalThis.Node | null, context: Context, boundary?: Boundary, appearance?: Appearance) {
  const fiber = range('function', parent, before, context);
  const resolved = componentProps(value.type, value.props, appearance);
  fiber.key = value.key;
  fiber.type = value.type;
  fiber.props = observe(resolved.props);
  fiber.boundary = boundary;
  fiber.appearance = resolved.appearance;
  fiber.scope = makeScope(context, (passive) => run(fiber, passive));
  fiber.render = () => enter(fiber.scope!, () => {
    const type = latest(fiber.type as Function);
    return resolve(type, fiber.props!, () => call(type, fiber.props));
  });
  track(fiber.type as Function, fiber.scope);
  probing(fiber);

  return complete(fiber, () => {
    run(fiber, passiveRender);
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
  fiber.scope = makeScope(childContext, (passive) => run(fiber, passive));
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
      run(fiber, passiveRender);
    });
  } finally {
    if (owned && !fiber.dead) inserted(fiber, () => (fiber.cleanup = instance.mount?.()));
  }

  return fiber;
}

function run(fiber: Fiber, passive: boolean) {
  const result = attempt(fiber, passive, fiber.render!);

  if (result !== true) return result;
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

function patchFunction(fiber: Fiber, value: VNode, appearance?: Appearance) {
  const resolved = componentProps(value.type, value.props, appearance);
  if (fiber.type !== value.type) {
    untrack(fiber.type as Function, fiber.scope!);
    fiber.type = value.type;
    track(fiber.type as Function, fiber.scope!);
  }
  fiber.appearance = resolved.appearance;
  fiber.props = observe(resolved.props);
  rerun(fiber, () => run(fiber, passiveRender));
}

function patchComponent(fiber: Fiber, value: RenderNode, appearance?: Appearance) {
  const resolved = isVNode(value)
    ? componentProps(value.type, value.props, appearance)
    : { appearance, props: fiber.props! };
  fiber.appearance = resolved.appearance;
  const props = isVNode(value) ? observe(resolved.props) : resolved.props;
  if (isVNode(value) && props !== fiber.props) {
    const instance = fiber.instance!;
    if (passiveRender) fiber.applied = true;
    if (instance instanceof Component) (instance as any).props = props;
    else instance.set(merge(fiber.props!, props) as never);
  }
  fiber.props = props;
  rerun(fiber, () => run(fiber, passiveRender));
}

function rerun(fiber: Fiber, run: () => void) {
  dequeue(fiber.scope!);
  run();
  absorb(fiber.scope!);
}

function unmountComponent(fiber: Fiber) {
  if (typeof fiber.cleanup == 'function') fiber.cleanup();
  fiber.childContext?.pop();
  if (fiber.owned && !fiber.instance!.get(null)) fiber.instance!.set(null);
}

function renderable(value: unknown): value is Renderable {
  return value instanceof Model && typeof (value as Renderable).render == 'function';
}

function merge(previous: Record<string, any>, next: Record<string, any>) {
  const output: Record<string, any> = {};
  for (const key in previous) output[key] = undefined;
  return { ...output, ...next };
}

export { mountComponent, mountFunction, mountOwnedComponent, patchComponent, patchFunction, renderable, unmountComponent };
