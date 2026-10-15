import { pending } from '@expressive/mvc';

interface Schedulable {
  queued?: 'urgent' | 'passive' | 'deferred';
  holds?: (() => void)[];
  probed?: { output: unknown };
  blocking?: (() => void)[];
  update(passive: boolean): PromiseLike<unknown> | void;
  probe?(): PromiseLike<unknown> | void;
  empty?(): boolean;
}

const urgent = new Set<Schedulable>();
const passive = new Set<Schedulable>();
const after: (() => void)[] = [];

let depth = 0;
let urgentQueued = false;
let passiveQueued = false;

function flush(scopes: Set<Schedulable>) {
  for (const scope of scopes) {
    scopes.delete(scope);
    scope.queued = undefined;

    let waiting: PromiseLike<unknown> | void = undefined;

    try {
      waiting = scope.update(false);
    } catch (error) {
      console.error(error);
    }

    settle(scope);
    if (!waiting) unblock(scope);
  }
}

function flushUrgent() {
  urgentQueued = false;
  flush(urgent);

  for (const run of after.splice(0)) run();
}

function afterFlush(run: () => void) {
  after.push(run);

  if (!urgentQueued) {
    urgentQueued = true;
    queueMicrotask(flushUrgent);
  }
}

function flushPassive() {
  passiveQueued = false;

  const batch = [...passive].filter((scope) => scope.queued === 'passive');
  passive.clear();

  for (const scope of batch) {
    const waiting = scope.probe?.();
    if (waiting) return defer(batch, waiting, scope);
  }

  batch.sort((a, b) => Number(!!b.empty?.()) - Number(!!a.empty?.()));

  for (let index = 0; index < batch.length; index++) {
    const scope = batch[index];

    if (scope.queued !== 'passive') continue;

    scope.queued = undefined;

    let waiting: PromiseLike<unknown> | void = undefined;

    try {
      waiting = scope.update(true);
    } catch (error) {
      console.error(error);
    }

    settle(scope);

    if (waiting) return defer(batch.slice(index + 1), waiting, scope);
    unblock(scope);
  }
}

function defer(scopes: Schedulable[], waiting: PromiseLike<unknown>, source: Schedulable) {
  const held = scopes.filter((scope) => scope.queued === 'passive');

  for (const scope of held) {
    scope.queued = 'deferred';
    scope.probed = undefined;
  }

  const resume = () => {
    for (const scope of held)
      if (scope.queued === 'deferred') {
        scope.queued = undefined;
        transition(() => schedule(scope));
      }
  };

  (source.blocking ||= []).push(resume);
  waiting.then(resume, resume);
}

function unblock(scope: Schedulable) {
  const { blocking } = scope;

  scope.blocking = undefined;
  blocking?.forEach((resume) => resume());
}

function release(holds?: (() => void)[]) {
  holds?.forEach((held) => held());
}

function settle(scope: Schedulable) {
  const { holds } = scope;

  scope.holds = undefined;
  release(holds);
}

function schedule(scope: Schedulable) {
  const held = pending();

  if (held) (scope.holds ||= []).push(held);
  scope.probed = undefined;

  if (!depth) {
    passive.delete(scope);
    scope.queued = 'urgent';
    urgent.add(scope);

    if (!urgentQueued) {
      urgentQueued = true;
      queueMicrotask(flushUrgent);
    }

    return;
  }

  if (scope.queued && scope.queued !== 'deferred') return;

  scope.queued = 'passive';
  passive.add(scope);

  if (!passiveQueued) {
    passiveQueued = true;
    setTimeout(flushPassive);
  }
}

function transition(work: () => void) {
  depth++;

  try {
    work();
  } finally {
    depth--;
  }
}

function claim(scope: Schedulable) {
  urgent.delete(scope);
  passive.delete(scope);
  scope.queued = undefined;
  scope.probed = undefined;
}

function unschedule(scope: Schedulable) {
  urgent.delete(scope);
  passive.delete(scope);
  scope.queued = undefined;
  scope.probed = undefined;
  settle(scope);
  unblock(scope);
}

export { afterFlush, claim, release, schedule, settle, transition, unschedule };
export type { Schedulable };
