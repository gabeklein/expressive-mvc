import "@expressive/dom";

import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { Context, State } from "@expressive/mvc";

interface Layer {
  prefix: string;
  context: Context;
  parent?: Layer;
  children: Map<string, Layer>;
  entries: number;
  calls: number;
}

interface Entry {
  Type: Keyed;
  key: string;
  layer: Layer;
  context: Context;
  instance: State;
  refs: number;
  timer?: ReturnType<typeof setTimeout>;
}

interface Frame {
  request: IncomingMessage;
  layer: Layer;
  held: Set<Entry>;
}

type Keyed = State.Type & { key?(prefix: string): string | number; ttl?: number };

const store = new AsyncLocalStorage<Frame>();
const registry = new Map<Keyed, Map<string, Entry>>();
let top: Layer | undefined;

function frame(): Frame {
  const frame = store.getStore();
  if (!frame) throw new Error("Server State resolves only within a sidecar call.");
  return frame;
}

function root(): Layer {
  if (!top) {
    top = { prefix: "", context: Context.root.push(), children: new Map(), entries: 0, calls: 0 };
    top.context.set({ 0: Current });
  }
  return top;
}

function walk(segments: string[]): Layer {
  let layer = root();

  for (const segment of segments) {
    const prefix = createHash("sha256").update(`${layer.prefix}/${segment}`).digest("base64url").slice(0, 22);
    let next = layer.children.get(prefix);

    if (!next) {
      next = { prefix, context: layer.context.push(), parent: layer, children: new Map(), entries: 0, calls: 0 };
      layer.children.set(prefix, next);
    }

    layer = next;
  }

  return layer;
}

function prune(layer: Layer) {
  for (let at: Layer | undefined = layer; at?.parent && !at.calls && !at.entries && !at.children.size; at = at.parent) {
    at.context.pop();
    at.parent.children.delete(at.prefix);
  }
}

function drop(entry: Entry) {
  const entries = registry.get(entry.Type);
  if (entries?.get(entry.key) !== entry) return;

  entries.delete(entry.key);
  clearTimeout(entry.timer);
  entry.context.pop();
  entry.layer.entries--;
  prune(entry.layer);
}

function release(entry: Entry) {
  if (--entry.refs) return;

  const ttl = entry.Type.ttl ?? 0;

  if (ttl > 0) (entry.timer = setTimeout(() => drop(entry), ttl * 1000)).unref();
  else drop(entry);
}

export async function within<T>(request: IncomingMessage, segments: string[], run: () => T): Promise<Awaited<T>> {
  const layer = walk(segments);
  const held = new Set<Entry>();

  layer.calls++;

  try {
    return await store.run({ request, layer, held }, run);
  } finally {
    layer.calls--;
    held.forEach(release);
    prune(layer);
  }
}

function use(this: Keyed) {
  const { layer, held } = frame();
  const key = this.key ? this.key(layer.prefix) : layer.prefix;

  if (typeof key != "string" && typeof key != "number")
    throw new Error(`${this.name}.key() returned ${key} - a key is a string or a number.`);

  const entries = registry.get(this) ?? registry.set(this, new Map()).get(this)!;
  let entry = entries.get(String(key));

  if (!entry) {
    let home = layer;
    while (home.parent && !String(key).startsWith(home.prefix)) home = home.parent;

    const context = home.context.push();
    let instance!: State;

    context.set({ 0: this }, state => { instance = state; });
    entry = { Type: this, key: String(key), layer: home, context, instance, refs: 0 };
    entries.set(entry.key, entry);
    home.entries++;

    const created = entry;
    instance.set(null, () => drop(created));
  }

  if (!held.has(entry)) {
    held.add(entry);
    entry.refs++;
    clearTimeout(entry.timer);
  }

  return entry.instance;
}

function get(this: typeof State, required?: boolean) {
  return frame().layer.context.get(this, required !== false);
}

export function install() {
  Object.assign(State, { use, get });
}

export class Current extends State {
  get request(): IncomingMessage {
    return frame().request;
  }
  set request(_: IncomingMessage) {
    throw new Error("Current is read-only.");
  }

  get url(): URL {
    return new URL(this.request.url ?? "/", "http://localhost");
  }
  set url(_: URL) {
    throw new Error("Current is read-only.");
  }

  get cookies(): Record<string, string> {
    const header = this.request.headers.cookie ?? "";
    return Object.fromEntries(header.split(";").filter(Boolean).map(pair => {
      const at = pair.indexOf("=");
      return [pair.slice(0, at).trim(), decodeURIComponent(pair.slice(at + 1).trim())];
    }));
  }
  set cookies(_: Record<string, string>) {
    throw new Error("Current is read-only.");
  }
}
