type Handler = () => void;
type Settle = void | Promise<void>;
type Transition = (work: Handler) => Settle;

interface Pending {
  count: number;
  done(): void;
}

interface Scheduled {
  transition?: Transition;
  pending?: Set<Pending>;
}

const DISPATCH = new Map<Handler, Scheduled>();
const RESOLVED = Promise.resolve();

let active: Transition | undefined;
let current: Pending | undefined;

function execute(work: Handler, transition?: Transition): Settle {
  if (!transition) return work();

  const parent = active;
  active = transition;

  try {
    return transition(work);
  } finally {
    active = parent;
  }
}

/**
 * Await this handler's replay for the transition being scheduled. Overlapping
 * transitions may each be waiting on the same handler, which replays once.
 */
function claim(scheduled: Scheduled) {
  if (!current || scheduled.pending?.has(current)) return;

  (scheduled.pending || (scheduled.pending = new Set())).add(current);
  current.count++;
}

function drop(scheduled: Scheduled) {
  const { pending } = scheduled;

  if (!pending) return;

  scheduled.pending = undefined;

  for (const record of pending)
    if (!--record.count) record.done();
}

function flush() {
  for (const [handler, scheduled] of DISPATCH) {
    DISPATCH.delete(handler);

    let settled: Settle = undefined;

    try {
      settled = execute(handler, scheduled.transition);
    } catch (err) {
      console.error(err);
    }

    if (settled instanceof Promise) {
      const release = () => drop(scheduled);
      settled.then(release, release);
    } else drop(scheduled);
  }
}

function enqueue(handler: Handler) {
  if (!DISPATCH.size) queueMicrotask(flush);

  const scheduled = DISPATCH.get(handler);

  if (!scheduled) {
    const next: Scheduled = { transition: active };

    DISPATCH.set(handler, next);
    claim(next);
  } else if (active) {
    claim(scheduled);
  } else {
    scheduled.transition = undefined;
    drop(scheduled);
  }
}

/**
 * Run `work` under `transition`, resolving once every subscriber update it
 * queued has replayed through that transition and the host has reported the
 * replay settled. A host which reports nothing resolves on replay.
 */
function schedule(work: Handler, transition?: Transition): Promise<void> {
  if (!transition || transition === active) {
    work();
    return RESOLVED;
  }

  const parent = current;
  const scheduled: Scheduled = {};
  const promise = new Promise<void>((resolve) => {
    scheduled.pending = new Set([current = { count: 1, done: resolve }]);
  });

  try {
    execute(work, transition);
  } finally {
    current = parent;
  }

  drop(scheduled);

  return promise;
}

export { enqueue, schedule };
