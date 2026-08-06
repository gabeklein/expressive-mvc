type Handler = () => void;
type Settle = void | Promise<void>;
type Transition = (work: Handler) => Settle;

interface Pending {
  count: number;
  done(): void;
}

interface Scheduled {
  transition?: Transition;
  pending?: Pending;
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

function drop(scheduled: Scheduled) {
  const { pending } = scheduled;

  if (!pending) return;

  scheduled.pending = undefined;

  if (!--pending.count) pending.done();
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

  if (scheduled) {
    if (!active) {
      scheduled.transition = undefined;
      drop(scheduled);
    }
  } else {
    if (current) current.count++;

    DISPATCH.set(handler, { transition: active, pending: current });
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
    scheduled.pending = current = { count: 1, done: resolve };
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
