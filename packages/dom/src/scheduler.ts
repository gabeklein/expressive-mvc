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

function flushUrgent() {
  urgentQueued = false;

  for (const scope of urgent) {
    urgent.delete(scope);
    scope.queued = undefined;
    scope.update(false);
    settle(scope);
  }
}

function flushPassive() {
  passiveQueued = false;

  for (const scope of passive) {
    passive.delete(scope);

    if (scope.queued !== 'passive') continue;

    scope.queued = undefined;
    scope.update(true);
    settle(scope);
  }
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

function unschedule(scope: Schedulable) {
  urgent.delete(scope);
  passive.delete(scope);
  scope.queued = undefined;
  settle(scope);
}

export { release, schedule, transition, unschedule };
export type { Schedulable };
