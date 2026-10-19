import { Context } from '@expressive/mvc';

import type { Node as RenderNode } from '../node/vnode';
import { appearanceRoot } from '../style/protocol';
import { attach, batched, fragment } from './commits';
import { range } from './fiber';
import { host } from './host';
import type { Container, Fiber } from './fiber';
import { unmountFiber } from './mount';
import { reconcile } from './reconcile';
import { consume, renderedAppearance } from './style';
import { settle, suspend, unwait } from './suspense';

const roots = new WeakMap<Container, () => void>();
let passiveRender = false;
let depth = 0;

function render(node: RenderNode, container: Container): () => void {
  roots.get(container)?.();
  host.clear(container);

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

function pass<T>(work: () => T): T {
  depth++;

  try {
    return work();
  } finally {
    if (!--depth) {
      settle();
      host.flush?.();
    }
  }
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
    try {
      const output = probed ? probed.output as RenderNode : consume(fiber, render);
      reconcile(fiber, output, scope.context, fiber.boundary, renderedAppearance(fiber));

      if (fiber.staging) {
        host.insert(host.parent(fiber.end)!, fiber.staging, fiber.end);
        attach(fiber.staging);
        fiber.staging = undefined;
      }

      if (!fiber.recovering) unwait(fiber);
      fiber.retried = undefined;
      return true;
    } catch (thrown) {
      return suspend(fiber, thrown, passive, empty);
    }
  });

  try {
    return passive ? batched(run) : run();
  } finally {
    passiveRender = previous;
  }
}

export { attempt, depth, pass, passiveRender, render };
