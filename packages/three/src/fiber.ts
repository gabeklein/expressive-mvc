import { Component, Context, State } from '@expressive/mvc';
import { capture, watch } from '@expressive/mvc/observable';
import { childrenOf, propsOf, typeOf, Fragment } from '@expressive/mvc/runtime';
import { Object3D } from 'three';

import { isElement, Three } from './node';

/**
 * A placement in the scene graph. A fiber owns hierarchy and existence only -
 * never the properties of the object it carries. Those belong to the class,
 * which drives them imperatively through its own effects.
 */
interface Fiber {
  type: unknown;
  id: unknown;
  parent?: Fiber;
  context: Context;
  children: Fiber[];
  /** Object contributed to the graph by this placement, once attached. */
  object?: Object3D;
  /** Re-invoke this placement's content with fresh props. */
  refresh?(props: Record<string, unknown>): void;
  release?(): void;
}

/**
 * Nearest ancestor object that children attach to.
 *
 * Resolved from the fiber tree, not from context: a State adopted by `has()` or
 * `map()` is registered in its *owner's* context, so a type lookup there can
 * find a sibling - or nothing, when two of them make it ambiguous.
 */
function container(fiber: Fiber): Object3D | undefined {
  for (let at: Fiber | undefined = fiber; at; at = at.parent)
    if (at.object) return at.object;
}

function create(parent: Fiber, type: unknown, id: unknown, node: Three.Node) {
  const fiber: Fiber = { type, id, parent, context: parent.context, children: [] };
  const props = propsOf(node);

  if (node instanceof Component) mount(fiber, node, false);
  else if (type === Fragment) {
    fiber.refresh = (next) => reconcile(fiber, next.children);
    fiber.refresh(props);
  } else if (Component.is(type)) {
    mount(fiber, new (type as State.Type<Component>)(props), true);
  } else if (typeof type == 'function') {
    fiber.refresh = (next) => reconcile(fiber, (type as Function)(next));
    fiber.refresh(props);
  } else
    throw new TypeError(`${String(type)} is not a valid element type.`);

  return fiber;
}

/**
 * Bind a Component instance to this placement. Rendering runs inside `watch`,
 * so the content re-reconciles when accessed values change - and, because
 * `watch` absorbs a thrown promise, a suspended component contributes nothing
 * to the graph until its values resolve.
 */
function mount(fiber: Fiber, instance: Component, owned: boolean) {
  const context = (fiber.context = new Context(fiber.context));

  context.set(instance, owned ? () => () => instance.set(null) : undefined);

  // No public seam pushes fresh props into a live Component - the field is
  // declared readonly, though its setter is what re-merges them into state.
  fiber.refresh = (props) => {
    (instance as { props: unknown }).props = props;
  };

  const stop = watch(instance, (self) => {
    const content = self.render(self.props);
    const object = (self as { object?: unknown }).object;

    // Attach after render, so a node which suspended stays out of the graph.
    if (object instanceof Object3D && !fiber.object) {
      fiber.object = object;
      container(fiber.parent!)!.add(object);
    }

    // Children mount in their own effect scope. Without this, effects created
    // while a child activates would register into *this* render's scope, and
    // the next render here would tear down every descendant's effects.
    capture(() => reconcile(fiber, content));
  });

  fiber.release = () => {
    stop();
    context.pop();
  };
}

/** Diff `output` against this fiber's current children by type and key. */
function reconcile(fiber: Fiber, output: unknown) {
  const prior = new Map<unknown, Map<unknown, Fiber>>();

  for (const child of fiber.children) {
    let group = prior.get(child.type);
    if (!group) prior.set(child.type, (group = new Map()));
    group.set(child.id, child);
  }

  fiber.children = childrenOf(output).map((node, index) => {
    const type = node instanceof Component ? node : typeOf(node);
    const id = (isElement(node) ? node.key : null) ?? index;
    const group = prior.get(type);
    const exists = group && group.get(id);

    if (!exists) return create(fiber, type, id, node);

    group!.delete(id);
    exists.refresh!(propsOf(node));

    return exists;
  });

  for (const group of prior.values())
    for (const stale of group.values()) remove(stale);
}

function remove(fiber: Fiber) {
  for (const child of fiber.children) remove(child);

  fiber.children = [];

  if (fiber.object && fiber.parent) fiber.object.removeFromParent();

  if (fiber.release) fiber.release();
}

/**
 * Mount `content` into a three.js object and return a teardown. Every
 * Component below gets its own context, so children resolve state with
 * `get(Type)` instead of receiving it as props.
 */
function render(content: Three.Node, into: Object3D, context?: Context) {
  const root: Fiber = {
    type: null,
    id: null,
    object: into,
    context: context || Context.root,
    children: []
  };

  reconcile(root, content);

  return () => remove(root);
}

export { Fiber, container, render };
