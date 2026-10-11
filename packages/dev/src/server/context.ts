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
  states: Map<Owned, Entry>;
  seat?: Entry;
  calls: number;
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
  const context = parent ? parent.context.push() : Context.root.push();
  return { prefix, context, parent, children: new Map(), states: new Map(), calls: 0 };
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
  const entry = layer.states.get(Seat) ?? create(Seat, layer);

  layer.seat = entry;
  hold(frame().held, entry);
}

const isEmpty = (layer: Layer) => !layer.calls && !layer.states.size && !layer.children.size;

function prune(layer: Layer) {
  let at = layer;

  while (at.parent && at.parent.children.get(at.prefix) === at && isEmpty(at)) {
    at.context.pop();
    at.parent.children.delete(at.prefix);
    at = at.parent;
  }
}

function drop(entry: Entry) {
  const { layer } = entry;
  if (layer.states.get(entry.Type) !== entry) return;

  if (layer.seat === entry) return evict(layer);

  discard(entry);
  prune(layer);
}

function discard(entry: Entry) {
  entry.layer.states.delete(entry.Type);
  clearTimeout(entry.timer);
  entry.remove();
  entry.context.pop();
}

function evict(layer: Layer) {
  layer.seat = undefined;
  layer.children.forEach(evict);
  layer.states.forEach(discard);

  if (!layer.parent) return;

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

  layer.states.set(Type, entry);
  track(instance);
  instance.set(null, () => drop(entry));

  return entry;
}

function hold(held: Set<Entry>, entry: Entry) {
  if (held.has(entry)) return;

  held.add(entry);
  entry.refs++;
  clearTimeout(entry.timer);
}

function use(this: Owned) {
  const { layer, held } = frame();
  const entry = layer.states.get(this) ?? create(this, layer);

  hold(held, entry);

  return entry.instance;
}

export function seated(): State | undefined {
  return frame().layer.seat?.instance;
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
