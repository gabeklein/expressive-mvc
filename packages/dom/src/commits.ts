interface Placed {
  start: Node;
  dead?: boolean;
}

type Entry = [Placed, () => unknown];

const DETACHED = new WeakMap<Node, Entry[]>();

let batch: Entry[] | undefined;

/** Run `run` once `fiber` is on the page: now, after the current batch, or when its detached root attaches. */
function inserted(fiber: Placed, run: () => unknown) {
  enqueue([fiber, run]);
}

/** A fragment whose commits wait until it attaches. */
function fragment() {
  const root = document.createDocumentFragment();

  DETACHED.set(root, []);
  return root;
}

function attach(root: Node) {
  const held = DETACHED.get(root);

  DETACHED.delete(root);
  held?.forEach(enqueue);
}

/** Defer commits made during `work` until it returns or throws. */
function batched<T>(work: () => T): T {
  if (batch) return work();

  const entries: Entry[] = (batch = []);

  try {
    return work();
  } finally {
    batch = undefined;
    entries.forEach(deliver);
  }
}

function enqueue(entry: Entry) {
  if (batch) batch.push(entry);
  else deliver(entry);
}

function deliver(entry: Entry) {
  const [fiber, run] = entry;
  const held = DETACHED.get(fiber.start.getRootNode());

  if (held) held.push(entry);
  else if (!fiber.dead) run();
}

export { attach, batched, fragment, inserted };
