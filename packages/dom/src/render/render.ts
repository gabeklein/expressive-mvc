import { Context } from '@expressive/mvc';

import type { Node as RenderNode } from '../node/vnode';
import { attach, batched, fragment } from './commits';
import { range } from './fiber';
import type { Container, Fiber } from './fiber';
import { unmountFiber } from './mount';
import { reconcile } from './reconcile';
import { consume, renderedAppearance } from './style';
import { settle, suspend, unwait } from './suspense';

const roots = new WeakMap<Container, () => void>();
const focusing: Element[] = [];
let passiveRender = false;
let rendering: Fiber | undefined;
let depth = 0;

/**
 * Mount a node into a container and return its unmount.
 *
 * Replaces the container's children and any root rendered there before. Unmount is idempotent.
 * A throw during the first render unmounts what it built, then propagates.
 */
function render(node: RenderNode, container: Container): () => void {
  roots.get(container)?.();
  container.replaceChildren();

  const context = new Context(Context.root);
  const fiber = range('fragment', container, null, context);

  try {
    pass(() => reconcile(fiber, node, context, undefined, undefined));
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

function pass<T>(work: () => T): T {
  depth++;

  try {
    return work();
  } finally {
    if (!--depth) {
      settle();
      focus();
    }
  }
}

function focus() {
  for (const element of focusing.splice(0))
    if (element.isConnected) (element as HTMLElement).focus();
}

function attempt(fiber: Fiber, passive: boolean, render: () => RenderNode): true | PromiseLike<unknown> | void {
  const previous = passiveRender;
  const scope = fiber.scope!;
  const probed = scope.probed;
  const empty = !fiber.children.length;

  scope.probed = undefined;
  passiveRender ||= passive;

  if (passive && !depth && empty && !fiber.stash)
    fiber.staging ||= fragment();

  const run = () => pass(() => {
    const parent = rendering;
    rendering = fiber;

    try {
      const output = probed ? probed.output as RenderNode : consume(fiber, render);
      reconcile(fiber, output, scope.context, fiber.boundary, renderedAppearance(fiber));

      if (fiber.staging) {
        fiber.end.parentNode!.insertBefore(fiber.staging, fiber.end);
        attach(fiber.staging);
        fiber.staging = undefined;
      }

      if (!fiber.recovering) unwait(fiber);
      fiber.retried = undefined;
      return true;
    } catch (thrown) {
      return suspend(fiber, thrown, passive, empty);
    } finally {
      rendering = parent;
    }
  });

  try {
    return passive ? batched(run) : run();
  } finally {
    passiveRender = previous;
  }
}

export { attempt, depth, focusing, pass, passiveRender, render, rendering };
