type Handler = () => void;
type Transition = (work: Handler) => void;

interface Scheduled {
  transition?: Transition;
}

const DISPATCH = new Map<Handler, Scheduled>();
let active: Transition | undefined;

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

function enqueue(handler: Handler) {
  if (!DISPATCH.size)
    queueMicrotask(() => {
      for (const [handler, scheduled] of DISPATCH) {
        DISPATCH.delete(handler);

        try {
          execute(handler, scheduled.transition);
        } catch (err) {
          console.error(err);
        }
      }
    });

  const scheduled = DISPATCH.get(handler);

  if (scheduled) {
    if (!active) scheduled.transition = undefined;
  } else {
    DISPATCH.set(handler, { transition: active });
  }
}

function schedule(work: Handler, transition?: Transition) {
  const parent = active;
  active = transition || parent;

  try {
    work();
  } finally {
    active = parent;
  }
}

export { enqueue, schedule };
