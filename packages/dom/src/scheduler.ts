interface Schedulable {
  queued?: 'urgent' | 'passive';
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
  }
}

function flushPassive() {
  passiveQueued = false;

  for (const scope of passive) {
    passive.delete(scope);

    if (scope.queued !== 'passive') continue;

    scope.queued = undefined;
    scope.update(true);
  }
}

function schedule(scope: Schedulable) {
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
}

export { schedule, transition, unschedule };
export type { Schedulable };
