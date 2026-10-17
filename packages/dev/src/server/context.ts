import "@expressive/dom";

import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { Context, State } from "@expressive/mvc";

import { track } from "./version";

interface Layer {
  prefix: string;
  context: Context;
  parent?: Layer;
  children: Map<string, Layer>;
  seat?: Entry;
  calls: number;
  pooled: number;
}

interface Entry {
  Type: Owned;
  layer: Layer;
  context: Context;
  instance: State;
  remove(): void;
  refs: number;
  timer?: ReturnType<typeof setTimeout>;
}

interface Frame {
  request: IncomingMessage;
  layer: Layer;
  held: Set<Entry>;
}

type Owned = State.Type & { ttl?: number };

export type Seat = Owned & { key?(): string | number | undefined };

const TTL = 300;

const store = new AsyncLocalStorage<Frame>();
let top: Layer | undefined;

function frame(): Frame {
  const frame = store.getStore();
  if (!frame) throw new Error("Server State resolves only within a sidecar call.");
  return frame;
}

function newLayer(prefix: string, parent?: Layer): Layer {
  const context = parent ? scope(parent).push() : Context.root.push();
  return { prefix, context, parent, children: new Map(), calls: 0, pooled: 0 };
}

function scope(layer: Layer): Context {
  return layer.seat ? layer.seat.context : layer.context;
}

function root(): Layer {
  if (!top) {
    top = newLayer("");
    top.context.set({ 0: Current });
  }

  return top;
}

function hash(text: string): string {
  return createHash("sha256").update(text).digest("base64url").slice(0, 22);
}

function keyOf(Seat: Seat): string | undefined {
  const key = Seat.key?.();

  if (key === undefined) return;
  if (typeof key != "string" && typeof key != "number")
    throw new Error(`${Seat.name}.key() returned ${key} - a key is a string, a number or undefined.`);

  return String(key);
}

function enter(parent: Layer, segment?: string, Seat?: Seat): Layer {
  let prefix = segment === undefined ? parent.prefix : hash(`${parent.prefix}/${segment}`);
  const key = Seat && keyOf(Seat);

  if (key !== undefined) prefix = hash(`${prefix}#${key}`);

  let layer = prefix === parent.prefix ? parent : parent.children.get(prefix);

  if (!layer) {
    layer = newLayer(prefix, parent);
    parent.children.set(prefix, layer);
  }

  if (Seat) seat(layer, Seat);

  return layer;
}

function seat(layer: Layer, Seat: Seat) {
  if (layer.seat?.Type !== Seat) {
    if (layer.seat) evict(layer, true);
    layer.seat = create(Seat, layer);
  }

  hold(frame().held, layer.seat);
}

const isEmpty = (layer: Layer) => !layer.calls && !layer.pooled && !layer.seat && !layer.children.size;

function prune(layer: Layer) {
  let at = layer;

  while (at.parent && at.parent.children.get(at.prefix) === at && isEmpty(at)) {
    at.context.pop();
    at.parent.children.delete(at.prefix);
    at = at.parent;
  }
}

function drop(entry: Entry) {
  if (entry.layer.seat === entry) evict(entry.layer);
}

function evict(layer: Layer, keep = false) {
  const entry = layer.seat;

  layer.seat = undefined;
  layer.children.forEach(child => evict(child));

  if (entry) {
    clearTimeout(entry.timer);
    entry.remove();
    entry.context.pop();
  }

  if (keep || !layer.parent) return;

  layer.context.pop();
  layer.parent.children.delete(layer.prefix);
}

function release(entry: Entry) {
  if (--entry.refs) return;

  const ttl = entry.Type.ttl ?? TTL;

  if (ttl <= 0) return drop(entry);

  entry.timer = setTimeout(() => drop(entry), ttl * 1000);
  entry.timer.unref();
}

export async function within<T>(request: IncomingMessage, segments: string[], run: () => T, seats: (Seat | undefined)[] = []): Promise<Awaited<T>> {
  const frame: Frame = { request, layer: root(), held: new Set() };

  return await store.run(frame, async (): Promise<Awaited<T>> => {
    try {
      frame.layer = enter(frame.layer, undefined, seats[0]);

      for (const [i, segment] of segments.entries())
        frame.layer = enter(frame.layer, segment, seats[i + 1]);

      frame.layer.calls++;

      try {
        return await run();
      } finally {
        frame.layer.calls--;
      }
    } finally {
      frame.held.forEach(release);
      prune(frame.layer);
    }
  });
}

function create(Type: Owned, layer: Layer): Entry {
  const context = layer.context.push();
  let instance!: State;

  context.set({ 0: Type }, state => { instance = state; });

  const remove = layer.context.add(instance, true);
  const entry: Entry = { Type, layer, context, instance, remove, refs: 0 };

  track(instance);
  instance.set(null, () => drop(entry));

  return entry;
}

function hold(held: Set<Entry>, entry: Entry) {
  held.add(entry);
  entry.refs++;
  clearTimeout(entry.timer);
}

let detached: Context | undefined;

function detachedContext(): Context {
  if (!detached) {
    detached = Context.root.push();
    detached.set({ 0: Current });
  }

  return detached;
}

export function construct(Type: State.Type, off = false): { instance: State; drop(): void; current(): boolean } {
  const layer = off ? undefined : frame().layer;
  const context = (layer ? scope(layer) : detachedContext()).push();
  let instance!: State;

  context.set({ 0: Type }, state => { instance = state; });
  track(instance);

  if (layer) {
    layer.pooled++;
    instance.set(null, () => {
      layer.pooled--;
      prune(layer);
    });
  }

  return {
    instance,
    drop: () => void (instance.get(null) || context.pop()),
    current: () => !instance.get(null) && (!layer || frame().layer === layer),
  };
}

export function seated(): State | undefined {
  return frame().layer.seat?.instance;
}

function get(this: typeof State, required?: boolean) {
  return scope(frame().layer).get(this, required !== false);
}

export function install() {
  Object.assign(State, { get });
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
