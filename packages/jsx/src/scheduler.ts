import { pending } from '@expressive/mvc';

interface Schedulable {
  queued?: 'urgent' | 'passive';
  holds?: (() => void)[];
  update(passive: boolean): void;
}

const urgent = new Set<Schedulable>();
const passive = new Set<Schedulable>();

let depth = 0;
let urgentQueued = false;
let passiveQueued = false;

function flush(scopes: Set<Schedulable>, isPassive: boolean) {
  for (const scope of scopes) {
    scopes.delete(scope);

    if (isPassive && scope.queued !== 'passive') continue;

    scope.queued = undefined;

    try {
      scope.update(isPassive);
    } catch (error) {
      console.error(error);
    }

    settle(scope);
  }
}

function flushUrgent() {
  urgentQueued = false;
  flush(urgent, false);
}

function flushPassive() {
  passiveQueued = false;
  flush(passive, true);
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

  if (scope.queued) return;

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
}

function unschedule(scope: Schedulable) {
  urgent.delete(scope);
  passive.delete(scope);
  scope.queued = undefined;
  settle(scope);
}

export { claim, release, schedule, settle, transition, unschedule };
export type { Schedulable };
