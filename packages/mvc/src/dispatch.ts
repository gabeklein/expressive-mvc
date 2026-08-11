type Handler = () => void;
type Transition = (work: Handler) => void;

interface Pending {
  count: number;
  done(): void;
}

interface Scheduled {
  transition?: Transition;
  pending?: Set<Pending>;
  holds?: number;
}

const DISPATCH = new Map<Handler, Scheduled>();
const RESOLVED = Promise.resolve();

let active: Transition | undefined;
let current: Set<Pending> | undefined;
let replaying: Scheduled | undefined;

function execute(work: Handler, transition?: Transition) {
  if (!transition) return work();

  const parent = active;

  active = transition;

  try {
    transition(work);
  } finally {
    active = parent;
  }
}

/**
 * Await this handler's replay for the transition being scheduled. Overlapping
 * transitions may each be waiting on the same handler, which replays once.
 */
function claim(scheduled: Scheduled) {
  if (!current) return;

  const pending = scheduled.pending || (scheduled.pending = new Set());

  for (const record of current)
    if (!pending.has(record)) {
      pending.add(record);
      record.count++;
    }
}

function drop(scheduled: Scheduled) {
  const { pending } = scheduled;

  if (!pending) return;

  scheduled.pending = undefined;

  for (const record of pending)
    if (!--record.count) record.done();
}

/**
 * Claim responsibility for presenting the update being replayed - settlement
 * waits on the returned callback rather than the replay itself. Returns
 * nothing where the replay is not deferred, so a subscriber pays for this only
 * during a transition.
 */
function presenting() {
  const scheduled = replaying;

  if (!scheduled || !scheduled.pending) return;

  scheduled.holds = (scheduled.holds || 0) + 1;

  let released = false;

  return () => {
    if (released) return;

    released = true;

    if (!--scheduled.holds!) drop(scheduled);
  };
}

function flush() {
  for (const [handler, scheduled] of DISPATCH) {
    DISPATCH.delete(handler);

    const parent = current;
    const outer = replaying;

    current = scheduled.pending;
    replaying = scheduled;

    try {
      execute(handler, scheduled.transition);
    } catch (err) {
      console.error(err);
    } finally {
      current = parent;
      replaying = outer;
    }

    if (!scheduled.holds) drop(scheduled);
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
 * queued has replayed and been presented. Subscribers which cannot report
 * presentation resolve on replay.
 */
function schedule(work: Handler, transition?: Transition): Promise<void> {
  if (!transition || transition === active) {
    work();
    return RESOLVED;
  }

  const parent = current;
  const scheduled: Scheduled = {};
  const promise = new Promise<void>((resolve) => {
    scheduled.pending = current = new Set([{ count: 1, done: resolve }]);
  });

  try {
    execute(work, transition);
  } finally {
    current = parent;
  }

  drop(scheduled);

  return promise;
}

export { enqueue, presenting, schedule };
