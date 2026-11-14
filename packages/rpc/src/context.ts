import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { Context, Model } from "@expressive/mvc";
import { resolver } from "@expressive/mvc/jsx-runtime";

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
  instance: Model;
  ready: Promise<void>;
  remove(): void;
  refs: number;
  timer?: ReturnType<typeof setTimeout>;
}

interface Frame {
  request: Request;
  layer: Layer;
  held: Set<Entry>;
  gated: { layer: Layer; built: Model[] }[];
  capture?: Model[];
}

type Owned = Model.Type & { ttl?: number };

export type Seat = Owned & { key?(): string | number | undefined };

/** A folder's gate as a function: it refuses by throwing, or by a Model it activates whose `new()` fails. */
export type Gate = () => unknown;

const TTL = 300;

const store = new AsyncLocalStorage<Frame>();
const SEATED = new WeakSet<Owned>();
const GATED = new WeakSet<Model>();
let top: Layer | undefined;
let built: ((instance: Model) => void) | undefined;

function frame(): Frame {
  const frame = store.getStore();
  if (!frame) throw new Error("Server Model resolves only within a call.");
  return frame;
}

function newLayer(prefix: string, parent?: Layer): Layer {
  const context = parent ? scope(parent).push() : Context.root.push(Current);
  return { prefix, context, parent, children: new Map(), calls: 0, pooled: 0 };
}

function scope(layer: Layer): Context {
  return layer.seat ? layer.seat.context : layer.context;
}

function root(): Layer {
  return (top ??= newLayer(""));
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

const isSeat = (guard: Seat | Gate): guard is Seat => guard.prototype instanceof Model;

/** Run a function gate in a layer of this request's own, which holds the Models it activates. */
async function gate(frame: Frame, fn: Gate) {
  const built: Model[] = [];

  frame.layer = newLayer(frame.layer.prefix, frame.layer);
  frame.gated.push({ layer: frame.layer, built });
  frame.capture = built;

  try {
    await fn();
  } finally {
    frame.capture = undefined;
  }

  await Promise.all(built.map(model => model.set()));
}

function ungate({ layer, built }: Frame["gated"][number]) {
  layer.children.forEach(child => evict(child));
  built.forEach(model => model.set(null));
  layer.context.pop();
}

export async function within<T>(request: Request, segments: string[], run: () => T, seats: (Seat | Gate | undefined)[] = []): Promise<Awaited<T>> {
  const frame: Frame = { request, layer: root(), held: new Set(), gated: [] };

  return await store.run(frame, async (): Promise<Awaited<T>> => {
    try {
      for (const [i, segment] of [undefined, ...segments].entries()) {
        const guard = seats[i];

        if (guard && !isSeat(guard)) {
          frame.layer = enter(frame.layer, segment);
          await gate(frame, guard);
          continue;
        }

        frame.layer = enter(frame.layer, segment, guard);
        await frame.layer.seat?.ready;
      }

      frame.layer.calls++;

      try {
        return await run();
      } finally {
        frame.layer.calls--;
      }
    } finally {
      frame.held.forEach(release);
      prune(frame.layer);
      frame.gated.reverse().forEach(ungate);
    }
  });
}

function create(Type: Owned, layer: Layer): Entry {
  if (!SEATED.has(Type)) {
    SEATED.add(Type);
    Type.on({ catch: (error, kind) => (kind == "setup" ? undefined : error) });
  }

  const context = layer.context.push(Type);
  const instance = context.get(Type)!;

  const remove = layer.context.add(instance, true);
  const ready = Promise.resolve(instance.get(() => {}));
  const entry: Entry = { Type, layer, context, instance, ready, remove, refs: 0 };

  built?.(instance);
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
    detached = Context.root.push(Current);
  }

  return detached;
}

export function construct(Type: Model.Type, off = false): { instance: Model; drop(): void; current(): boolean } {
  const layer = off ? undefined : frame().layer;
  const context = (layer ? scope(layer) : detachedContext()).push(Type);
  const instance = context.get(Type)!;

  built?.(instance);

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

export function seated(): Model | undefined {
  return frame().layer.seat?.instance;
}

export function onBuild(hook: (instance: Model) => void) {
  built = hook;
}

let watching = false;

function watch() {
  if (watching) return;
  watching = true;

  Model.on({
    setup() {
      const frame = store.getStore();

      if (!frame?.capture) return;

      frame.capture.push(this);
      frame.layer.context.add(this, true);
      GATED.add(this);
    },
    catch(error, kind) {
      return kind == "setup" && GATED.has(this) ? undefined : error;
    },
  });
}

export function install() {
  watch();

  const previous = resolver((Type, compute) => {
    if (!Type && !store.getStore()) return previous(Type, compute);
    return compute(scope(frame().layer));
  });
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

interface Outgoing {
  headers: Headers;
  flush: Set<() => void>;
}

const outgoing = new WeakMap<Request, Outgoing>();

/** The request of the call in progress, if any. */
export function active(): Request | undefined {
  return store.getStore()?.request;
}

/** The reply-to-be of the call in progress: headers to add, and work to run just before they are read. */
export function outgoingOf(request = frame().request): Outgoing {
  let out = outgoing.get(request);

  if (!out) outgoing.set(request, (out = { headers: new Headers(), flush: new Set() }));

  return out;
}

/** What the calls on `request` asked to add to its reply. */
export function headersOf(request: Request): Headers | undefined {
  const out = outgoing.get(request);

  if (!out) return;

  out.flush.forEach(flush => flush());
  out.flush.clear();

  return out.headers;
}

const readOnly = () => {
  throw new Error("Current is read-only.");
};

export class Current extends Model {
  get request(): Request {
    return frame().request;
  }
  set request(_: Request) {
    readOnly();
  }

  get url(): URL {
    return new URL(this.request.url);
  }
  set url(_: URL) {
    readOnly();
  }

  get cookies(): Record<string, string> {
    return parseCookies(this.request.headers.get("cookie") ?? undefined);
  }
  set cookies(_: Record<string, string>) {
    readOnly();
  }

  /** Set a header on this call's reply. The reply's own (`content-type` and the like) win. For cookies, see `Cookies`. */
  setHeader(name: string, value: string): void {
    const { headers } = outgoingOf();

    if (name.toLowerCase() === "set-cookie") headers.append(name, value);
    else headers.set(name, value);
  }
}
