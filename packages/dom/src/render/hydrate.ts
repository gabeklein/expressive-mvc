interface Claiming {
  root: globalThis.Node;
  cursors: Map<globalThis.Node, globalThis.Node | null>;
  claimed: WeakSet<globalThis.Node>;
  touched: Set<globalThis.Node>;
  kept: Map<globalThis.Node, globalThis.Node>;
}

let state: Claiming | undefined;

function claiming(parent: globalThis.Node) {
  return !!state && state.root.contains(parent);
}

function next(parent: globalThis.Node) {
  const { claimed, cursors, touched } = state!;
  let node = cursors.has(parent) ? cursors.get(parent)! : parent.firstChild;

  touched.add(parent);
  while (node && claimed.has(node)) node = node.nextSibling;

  return node;
}

function adopt<T extends globalThis.Node>(
  parent: globalThis.Node,
  before: globalThis.Node | null,
  create: () => T,
  match: (node: globalThis.Node) => boolean
): T {
  if (!claiming(parent)) {
    const node = create();
    parent.insertBefore(node, before);
    return node;
  }

  const candidate = next(parent);

  if (candidate && match(candidate)) {
    state!.claimed.add(candidate);
    state!.cursors.set(parent, candidate.nextSibling);
    return candidate as T;
  }

  const node = create();
  parent.insertBefore(node, candidate || before);
  state!.claimed.add(node);
  return node;
}

function adoptText(parent: globalThis.Node, before: globalThis.Node | null, value: string) {
  return adopt(parent, before, () => document.createTextNode(value), (node) => {
    if (node.nodeType != 3 || !value) return false;

    const text = node as Text;

    if (text.data.length > value.length && text.data.startsWith(value)) text.splitText(value.length);

    return text.data === value;
  });
}

function adoptRange(parent: globalThis.Node, before: globalThis.Node | null, kind: string) {
  const start = adopt(parent, before, () => document.createComment(kind), (node) => isComment(node, kind));

  if (!claiming(parent) || !state!.cursors.has(parent) || state!.cursors.get(parent) !== start.nextSibling)
    return [start, place(parent, start, document.createComment(`/${kind}`))];

  const end = closer(start, kind);

  if (!end) return [start, place(parent, start, document.createComment(`/${kind}`))];

  state!.claimed.add(end);
  return [start, end];
}

function place(parent: globalThis.Node, after: globalThis.Node, node: globalThis.Node) {
  parent.insertBefore(node, after.nextSibling);
  state?.claimed.add(node);
  return node;
}

function closer(start: globalThis.Node, kind: string) {
  let depth = 0;

  for (let node = start.nextSibling; node; node = node.nextSibling) {
    if (node.nodeType != 8) continue;

    const { data } = node as Comment;

    if (data[0] != '/') depth++;
    else if (depth) depth--;
    else return data == `/${kind}` ? node : undefined;
  }
}

function isComment(node: globalThis.Node, data: string) {
  return node.nodeType == 8 && (node as Comment).data == data;
}

/** Leave a suspended range's server markup in place until it renders. */
function keep(start: globalThis.Node, end: globalThis.Node) {
  if (!state || !claiming(start.parentNode!)) return false;

  state.kept.set(start, end);
  state.cursors.set(start.parentNode!, end.nextSibling);
  return true;
}

/**
 * Run `work` claiming existing nodes under `root` instead of creating them, then remove what went unclaimed.
 *
 * `from` and `to` bound the cleanup of `root` itself to the nodes between them.
 */
function hydrating<T>(root: globalThis.Node, work: () => T, from: globalThis.Node | null = null, to: globalThis.Node | null = null): T {
  const previous = state;
  const current: Claiming = (state = {
    root,
    cursors: new Map(from ? [[root, from.nextSibling]] : []),
    claimed: new WeakSet(from && to ? [from, to] : []),
    touched: new Set(),
    kept: new Map()
  });

  try {
    return work();
  } finally {
    state = previous;

    for (const parent of current.touched) {
      let node: globalThis.Node | null = parent === root && from ? from.nextSibling : parent.firstChild;

      while (node && !(parent === root && node === to)) {
        const following: globalThis.Node | null = (current.kept.get(node) || node).nextSibling;

        if (!current.claimed.has(node) && !current.kept.has(node)) (node as ChildNode).remove();
        node = following;
      }
    }
  }
}

export { adopt, adoptRange, adoptText, hydrating, keep };
