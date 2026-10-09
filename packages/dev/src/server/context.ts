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

function newLayer(prefix: string, parent?: Layer): Layer {
  const context = parent ? parent.context.push() : Context.root.push();
  return { prefix, context, parent, children: new Map(), entries: 0, calls: 0 };
}

function root(): Layer {
  if (!top) {
    top = newLayer("");
    top.context.set({ 0: Current });
  }

  return top;
}

function childPrefix(parent: string, segment: string): string {
  const hash = createHash("sha256").update(`${parent}/${segment}`);
  return hash.digest("base64url").slice(0, 22);
}

function walk(segments: string[]): Layer {
  let layer = root();

  for (const segment of segments) {
    const prefix = childPrefix(layer.prefix, segment);
    let next = layer.children.get(prefix);

    if (!next) {
      next = newLayer(prefix, layer);
      layer.children.set(prefix, next);
    }

    layer = next;
  }

  return layer;
}

const isEmpty = (layer: Layer) => !layer.calls && !layer.entries && !layer.children.size;

function prune(layer: Layer) {
  let at = layer;

  while (at.parent && isEmpty(at)) {
    at.context.pop();
    at.parent.children.delete(at.prefix);
    at = at.parent;
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

  if (ttl <= 0) return drop(entry);

  entry.timer = setTimeout(() => drop(entry), ttl * 1000);
  entry.timer.unref();
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

function keyOf(Type: Keyed, prefix: string): string {
  const key = Type.key ? Type.key(prefix) : prefix;

  if (typeof key != "string" && typeof key != "number")
    throw new Error(`${Type.name}.key() returned ${key} - a key is a string or a number.`);

  return String(key);
}

function homeOf(layer: Layer, key: string): Layer {
  let home = layer;

  while (home.parent && !key.startsWith(home.prefix)) home = home.parent;

  return home;
}

function entriesOf(Type: Keyed): Map<string, Entry> {
  let entries = registry.get(Type);

  if (!entries) registry.set(Type, entries = new Map());

  return entries;
}

function create(Type: Keyed, key: string, home: Layer): Entry {
  const context = home.context.push();
  let instance!: State;

  context.set({ 0: Type }, state => { instance = state; });

  const entry: Entry = { Type, key, layer: home, context, instance, refs: 0 };

  entriesOf(Type).set(key, entry);
  home.entries++;
  instance.set(null, () => drop(entry));

  return entry;
}

function hold(held: Set<Entry>, entry: Entry) {
  if (held.has(entry)) return;

  held.add(entry);
  entry.refs++;
  clearTimeout(entry.timer);
}

function use(this: Keyed) {
  const { layer, held } = frame();
  const key = keyOf(this, layer.prefix);
  const entry = entriesOf(this).get(key) ?? create(this, key, homeOf(layer, key));

  hold(held, entry);

  return entry.instance;
}

function get(this: typeof State, required?: boolean) {
  return frame().layer.context.get(this, required !== false);
}

export function install() {
  Object.assign(State, { use, get });
}

function parseCookies(header = ""): Record<string, string> {
  const pairs = header.split(";").filter(Boolean).map(pair => {
    const at = pair.indexOf("=");
    const name = pair.slice(0, at).trim();
    const value = decodeURIComponent(pair.slice(at + 1).trim());

    return [name, value];
  });

  return Object.fromEntries(pairs);
}

const readOnly = () => {
  throw new Error("Current is read-only.");
};

export class Current extends State {
  get request(): IncomingMessage {
    return frame().request;
  }
  set request(_: IncomingMessage) {
    readOnly();
  }

  get url(): URL {
    return new URL(this.request.url ?? "/", "http://localhost");
  }
  set url(_: URL) {
    readOnly();
  }

  get cookies(): Record<string, string> {
    return parseCookies(this.request.headers.cookie);
  }
  set cookies(_: Record<string, string>) {
    readOnly();
  }
}
