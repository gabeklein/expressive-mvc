import { Component, Context } from '@expressive/mvc';
import { capture, watch } from '@expressive/mvc/observable';
import { Fragment, childrenOf, isElement, type Element } from './jsx-runtime';
import { terminal, type Output } from './terminal';

type Content = string | number | Element;

interface Slot {
  kind: 'text' | 'fragment' | 'function' | 'component';
  parent?: Slot;
  context?: Context;
  key?: unknown;
  type?: unknown;
  text?: string;
  instance?: Component;
  children: Slot[];
  release?: () => void;
}

interface App {
  invalidate(): void;
}

declare namespace render {
  interface Options {
    /** Destination stream; defaults to `process.stdout`. */
    output?: Output;
    /** Context to render within; defaults to `Context.root`. */
    context?: Context;
  }

  interface Rendered {
    /** Current output for the mounted tree. */
    readonly frame: string;
    /** Destroy the tree; prints the final frame to non-interactive output. */
    unmount(): void;
  }
}

let RENDERING = 0;

function render(node: Component.Node, options: render.Options = {}): render.Rendered {
  const screen = terminal(options.output || process.stdout);
  const context = (options.context || Context.root).push();

  let scheduled = false;
  let alive = true;

  const app: App = {
    invalidate() {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (alive) screen.update(output(root));
      });
    }
  };

  const root: Slot = { kind: 'fragment', context, children: [] };

  root.children = reconcile(root, [], childrenOf(node) as Content[], app);
  screen.update(output(root));

  return {
    get frame() {
      return output(root);
    },
    unmount() {
      if (!alive) return;
      alive = false;
      screen.done(output(root));
      teardown(root);
      context.pop();
    }
  };
}

function output(slot: Slot): string {
  return slot.kind == 'text'
    ? slot.text!
    : slot.children.map(output).join('');
}

function mount(node: Content, parent: Slot, app: App): Slot {
  if (!isElement(node))
    return {
      kind: 'text',
      parent,
      context: parent.context,
      text: String(node),
      children: []
    };

  const { type, props, key } = node;
  const slot: Slot = {
    kind: 'fragment',
    parent,
    context: parent.context,
    key,
    type,
    children: []
  };

  if (type === Fragment) {
    slot.children = reconcile(slot, [], childrenOf(props.children) as Content[], app);
    return slot;
  }

  if (Component.is(type)) {
    const context = parent.context!.push();
    const instance = new (type as new (props: object) => Component)(props);

    context.set(instance, () => () => instance.set(null));

    slot.kind = 'component';
    slot.context = context;
    slot.instance = instance;

    activate(slot, app);
    return slot;
  }

  if (typeof type == 'function') {
    slot.kind = 'function';
    slot.children = reconcile(
      slot, [], childrenOf((type as Function)(props)) as Content[], app
    );
    return slot;
  }

  throw new Error(
    `Unsupported element type: <${String(type)}>. ` +
    '@expressive/cli renders components and text only - no intrinsic tags exist yet.'
  );
}

function activate(slot: Slot, app: App) {
  const instance = slot.instance!;

  slot.release = watch(instance, (proxy: Component) => {
    RENDERING++;
    try {
      show(slot, proxy.render(proxy.props as {}), app);
    } catch (err) {
      if (err instanceof Promise) {
        show(slot, proxy.fallback, app);
        throw err.then(noop, noop);
      }
      recover(slot, err, app);
    } finally {
      RENDERING--;
    }
  });
}

function show(slot: Slot, content: unknown, app: App) {
  slot.children = reconcile(slot, slot.children, childrenOf(content) as Content[], app);
  app.invalidate();
}

function recover(slot: Slot, error: unknown, app: App) {
  let boundary: Slot | undefined = slot;

  while (boundary && !boundary.instance?.catch) boundary = boundary.parent;

  if (!boundary || (boundary !== slot && RENDERING > 1)) throw error;

  const instance = boundary.instance!;
  const result = instance.catch!(error as Error);

  show(boundary, instance.fallback, app);

  Promise.resolve(result).then(() => {
    if (!boundary.release) return;
    boundary.release();
    activate(boundary, app);
  });
}

function noop() { }

/**
 * Slot teardown is owned by the renderer, so children must not register with a
 * parent effect - `capture` scopes them out of the enclosing render's cleanup.
 */
function reconcile(parent: Slot, current: Slot[], content: Content[], app: App): Slot[] {
  let next!: Slot[];
  capture(() => {
    next = sync(parent, current, content, app);
  });
  return next;
}

function sync(parent: Slot, current: Slot[], content: Content[], app: App): Slot[] {
  const keyed = new Map<unknown, Slot>();
  const rest: Slot[] = [];

  for (const slot of current)
    if (slot.key != null) keyed.set(slot.key, slot);
    else rest.push(slot);

  const next: Slot[] = [];

  for (const node of content) {
    const key = isElement(node) ? node.key : undefined;
    let prior: Slot | undefined;

    if (key != null) {
      prior = keyed.get(key);
      keyed.delete(key);
    }
    else prior = rest.shift();

    if (prior && compatible(prior, node)) {
      update(prior, node, app);
      next.push(prior);
    }
    else {
      if (prior) teardown(prior);
      next.push(mount(node, parent, app));
    }
  }

  keyed.forEach(teardown);
  rest.forEach(teardown);

  return next;
}

function compatible(slot: Slot, node: Content) {
  return isElement(node)
    ? slot.type === node.type
    : slot.kind == 'text';
}

function update(slot: Slot, node: Content, app: App) {
  if (!isElement(node)) {
    const text = String(node);
    if (text !== slot.text) {
      slot.text = text;
      app.invalidate();
    }
    return;
  }

  const { type, props } = node;

  if (slot.kind == 'component')
    (slot.instance as { props: unknown }).props = props;
  else if (slot.kind == 'function')
    show(slot, (type as Function)(props), app);
  else
    show(slot, props.children, app);
}

function teardown(slot: Slot) {
  slot.children.forEach(teardown);
  slot.children = [];

  if (slot.release) {
    slot.release();
    slot.release = undefined;
  }

  if (slot.kind == 'component') slot.context!.pop();
}

export { render };
