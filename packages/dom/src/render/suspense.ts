import { fragment } from './commits';
import { move, moveRange, range } from './fiber';
import type { Boundary, Fiber } from './fiber';
import { unmountFiber } from './mount';
import { reconcile } from './reconcile';
import { depth, pass } from './render';
import { release, schedule, transition } from './scheduler';

const dirty = new Set<Boundary>();
const stashes = new WeakMap<globalThis.Node, Fiber>();
let holding: { thrown: unknown; fiber?: Fiber } | undefined;
let settling = false;

function park(fiber: Fiber) {
  move(fiber, fragment(), null);
}

function hold(fiber: Fiber, error: unknown) {
  if (!holding || error !== holding.thrown) return false;

  park(fiber);
  holding.fiber = fiber;
  return true;
}

function gather(error: unknown, next: Fiber[], old: Fiber[]) {
  if (!holding || error !== holding.thrown) return;

  for (const fiber of next) if (!old.includes(fiber)) park(fiber);
  if (holding.fiber) next.push(holding.fiber);
  holding.fiber = undefined;
}

function hostOf(parent: globalThis.Node) {
  let host = parent;

  for (let owner = stashes.get(host); owner; owner = stashes.get(host))
    host = owner.end.parentNode!;

  return host;
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

function suspend(fiber: Fiber, thrown: unknown, passive: boolean, empty: boolean) {
  const boundary = fiber.boundary;

  if (isThenable(thrown)) {
    if (!boundary) throw thrown;
    if (passive && empty && depth > 1) {
      if (holding?.thrown !== thrown) holding = { thrown };
      throw thrown;
    }

    holding = undefined;
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
      (error) => resume(() => pass(() => recover(fiber, error, fiber.boundary)))
    );
    return thrown;
  }

  recover(fiber, thrown, fiber.boundary);
}

function recover(fiber: Fiber, thrown: unknown, boundary: Boundary | undefined) {
  const error = thrown instanceof Error ? thrown : new Error(String(thrown));

  while (boundary && !boundary.catch) boundary = boundary.parent;

  if (!boundary) throw error;

  const handler = boundary;

  const token = {};

  wait(fiber, handler);
  fiber.recovering = token;

  Promise.resolve(handler.catch!(error)).then(
    () => {
      if (fiber.recovering !== token) return;
      fiber.recovering = undefined;
      if (!fiber.scope!.active || fiber.retried) return;
      fiber.retried = true;
      schedule(fiber.scope!);
    },
    (next) => {
      if (fiber.recovering === token && fiber.scope!.active) pass(() => recover(fiber, next, handler.parent));
    }
  );
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return !!value && typeof (value as PromiseLike<unknown>).then == 'function';
}

export { gather, hold, hostOf, isThenable, settle, suspend, unwait };
