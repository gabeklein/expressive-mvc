import { Caught, Context, State } from '@expressive/mvc';
import { isElement } from '@expressive/mvc/runtime';

import { act as run, journal, note, noteCall, noteCaught, noteDestroy, recordsCalls, type Frame, type Query } from './journal';
import { entries, parsePath, serialize, walk } from './serialize';
import { forget, seen, type TypeInfo } from './types';

export interface Model extends TypeInfo {
  id: string;
  parent?: string;
  /** Keys with a stored value. */
  keys: string[];
  /** Declared keys with no stored value yet - lazy, pending, or uncomputed. */
  absent: string[];
}

export interface Node {
  id: string;
  type: string;
  children: Node[];
}

interface Span {
  since: number;
  until?: number;
  claimed: boolean;
  settled: boolean;
}

interface Row {
  ref: { deref(): State | undefined };
  held?: State;
}

const Reaper: typeof FinalizationRegistry =
  typeof FinalizationRegistry === 'function'
    ? FinalizationRegistry
    : (class {
        register() {}
        unregister() {}
      } as unknown as typeof FinalizationRegistry);

const weak = (state: State): Row['ref'] =>
  typeof WeakRef === 'function' ? new WeakRef(state) : { deref: () => state };

const live = new Map<string, Row>();
const hooks = new Map<typeof State, () => void>();

const CASES = ['Destroyed', 'Inactive', 'Getter', 'Init', 'Effect'] as const;
const COPIES = Symbol.for('@expressive/mvc');

type Case = (typeof CASES)[number];
const wrapped = new WeakSet<State>();
const wrappers = new WeakMap<State, Instance>();
const spans = new WeakMap<State, Span>();
const reaper = new Reaper<string>(collected);

let version = 0;
let cached: { version: number; parents: Map<State, State> } | undefined;
let lost = 0;
let tally = counts();
let copies = 1;
let unwatch: (() => void) | undefined;

function counts(): Record<Case, number> {
  return { Destroyed: 0, Inactive: 0, Getter: 0, Init: 0, Effect: 0 };
}

function caught(error: Caught) {
  const name = CASES.find((type) => error instanceof Caught[type]);
  if (name) tally[name]++;
  noteCaught(error, name || 'Caught');
  return error;
}

/** Count loaded copies of mvc from the list each one joins on first construction; warn once on a second. */
function watchCopies() {
  const list = ((globalThis as { [COPIES]?: unknown[] })[COPIES] ||= []);
  const { push } = list;
  const check = () => {
    const was = copies;
    copies = new Set([State, ...list]).size;
    if (copies > 1 && was === 1)
      console.warn(`${copies} copies of @expressive/mvc are loaded - inspect sees only the one it imports.`);
  };

  list.push = (...items) => {
    const length = push.apply(list, items);
    check();
    return length;
  };

  check();
  unwatch = () => {
    list.push = push;
  };
}

/** Registered instances still reachable, claimed or not. */
function registered(): State[] {
  return [...live.values()]
    .map((row) => row.held ?? row.ref.deref())
    .filter((state): state is State => !!state);
}

/** Instances on the mainline: claimed, or too young to judge, or every one when no host renders. */
function* mainline(): Generator<State> {
  const parents = ownership();
  for (const state of registered()) if (!orphaned(state, parents)) yield state;
}

function orphaned(state: State, parents: Map<State, State>, seen = new Set<State>()): boolean {
  const span = spans.get(state)!;
  if (span.claimed || !span.settled || !hosted()) return false;
  if (provided(state)) {
    claim(state);
    return false;
  }
  const owner = parents.get(state);
  if (!owner || seen.has(owner)) return true;
  seen.add(state);
  if (orphaned(owner, parents, seen)) return true;
  if (spans.get(owner)!.claimed) claim(state);
  return false;
}

function claim(state: State) {
  const span = spans.get(state)!;
  if (span.claimed) return;
  span.claimed = true;
  const row = live.get(String(state));
  if (row) {
    row.held = state;
    reaper.unregister(state);
  }
  version++;
}

/** A `static global` instance currently holding its slot in the root context. */
function provided(state: State): boolean {
  const type = state.constructor as typeof State;
  const global = typeof type.global === 'function' ? type.global(state) : type.global;
  if (!global) return false;
  for (const set of Context.root.provide.values())
    if (set) for (const [member] of set) if (member === state) return true;
  return false;
}

function hosted(): boolean {
  try {
    isElement(null);
    return true;
  } catch {
    return false;
  }
}

/** A registered, unclaimed instance was garbage collected - it was abandoned. */
export function collected(id: string): void {
  if (!live.delete(id)) return;
  lost++;
  version++;
}

/** Navigable view of one instance - identity, ownership, reads, observation. One per state; outlives it. */
export class Instance {
  private constructor(readonly state: State) {}

  static of(state: State): Instance {
    let instance = wrappers.get(state);
    if (!instance) wrappers.set(state, (instance = new Instance(state)));
    return instance;
  }

  get id() {
    return String(this.state);
  }

  get type() {
    return seen(this.state.constructor as typeof State).type;
  }

  get alive() {
    return live.has(this.id);
  }

  /** Reached by a host commit (`mount`), a claimed owner, or `static global`. Always true without a host. */
  get claimed() {
    return !orphaned(this.state, ownership());
  }

  /** Registration time (ms). */
  get since() {
    return spans.get(this.state)!.since;
  }

  /** Destruction time (ms), once destroyed. */
  get until() {
    return spans.get(this.state)!.until;
  }

  get parent(): Instance | undefined {
    const owner = ownership().get(this.state);
    return owner && Instance.of(owner);
  }

  get children(): Instance[] {
    const parents = ownership();
    return [...registered()]
      .filter((state) => parents.get(state) === this.state)
      .map(Instance.of);
  }

  /** First instance in this subtree, depth-first, matching `where` (a label or predicate). */
  find(where: string | ((instance: Instance) => boolean)): Instance | undefined {
    const test = typeof where === 'string' ? (h: Instance) => h.type === where : where;
    for (const child of this.children) {
      if (test(child)) return child;
      const deep = child.find(test);
      if (deep) return deep;
    }
    return undefined;
  }

  get(path?: string): unknown {
    return serialize(walk(this.state, path));
  }

  model(): Model {
    return describe(this.state, ownership());
  }

  /** Run `work`, settle, and return the frames it produced. */
  act(work: (state: State) => unknown): Promise<Frame[]> {
    return run(() => work(this.state));
  }

  /** Call `fn` on each update, and with `null` on destroy; `keys` narrows updates. Returns unsubscribe. */
  watch(fn: (key: string | null) => void, keys?: string[]): () => void {
    const updates = this.state.set((key) => {
      if (typeof key === 'string' && (!keys || keys.includes(key))) fn(key);
    });
    const destroy = this.state.get(null, () => fn(null));
    return () => {
      updates();
      destroy();
    };
  }

  frames(query: Query = {}): Frame[] {
    return journal.frames({ ...query, id: this.id });
  }
}

export function attach(Type: typeof State = State): () => void {
  if (!unwatch) watchCopies();

  if (!hooks.has(Type)) {
    const stopCatch = Type.on({ catch: caught });
    const stopSetup = Type.on(function (this: State) {
      const self = this.is;
      const id = String(self);
      const span: Span = { since: Date.now(), claimed: false, settled: false };
      seen(self.constructor as typeof State);
      live.set(id, { ref: weak(self) });
      spans.set(self, span);
      reaper.register(self, id, self);
      setTimeout(() => {
        span.settled = true;
      }, 0);
      version++;
      if (recordsCalls()) wrap(self);
      mounts(self);
      const stop = self.set((key) => {
        const store = entries(self);
        if (typeof key === 'string' && typeof store.get(key) === 'object') version++;
        note(self, key, store);
      });
      return () => {
        stop();
        live.delete(id);
        reaper.unregister(self);
        span.until = Date.now();
        version++;
        noteDestroy(self);
      };
    });

    hooks.set(Type, () => {
      stopCatch();
      stopSetup();
    });
  }

  return () => {
    hooks.get(Type)?.();
    hooks.delete(Type);
  };
}

export function detach(): void {
  for (const stop of hooks.values()) stop();
  hooks.clear();
  live.clear();
  cached = undefined;
  lost = 0;
  tally = counts();
  copies = 1;
  unwatch?.();
  unwatch = undefined;
  journal.reset();
  forget();
}

/** Resolve an id or label to an instance - mainline first, then orphans. */
export function find(target: string): Instance | undefined {
  const byId = live.get(target);
  const held = byId && (byId.held ?? byId.ref.deref());
  if (held) return Instance.of(held);
  for (const pool of [mainline(), abandoned()])
    for (const state of pool)
      if (seen(state.constructor as typeof State).type === target) return Instance.of(state);
  return undefined;
}

export function instances(): Instance[] {
  return [...mainline()].map(Instance.of);
}

/** Registered and settled, but never claimed by a host commit, an owner, or root context. */
export function orphans(): Instance[] {
  return [...abandoned()].map(Instance.of);
}

function* abandoned(): Generator<State> {
  const parents = ownership();
  for (const state of registered()) if (orphaned(state, parents)) yield state;
}

export interface Health {
  /** Live instances no host, owner, or root slot claimed. */
  orphans: number;
  /** Unclaimed instances the collector already reaped. */
  collected: number;
  /** Loaded copies of `@expressive/mvc` - more than 1 means inspect cannot see every State. */
  copies: number;
  /** Reports reaching inspect's `catch` handler, by case. */
  caught: Record<Case, number>;
}

/** Counts worth a look before trusting what inspect shows. */
export function health(): Health {
  return { orphans: orphans().length, collected: lost, copies, caught: { ...tally } };
}

export function roots(): Instance[] {
  const parents = ownership();
  return instances().filter((instance) => !parents.has(instance.state));
}

export function models(): Model[] {
  const parents = ownership();
  return [...mainline()].map((state) => describe(state, parents));
}

export function tree(): Node[] {
  const parents = ownership();
  const nodes = new Map<State, Node>();
  const out: Node[] = [];

  for (const state of mainline())
    nodes.set(state, { id: String(state), type: seen(state.constructor as typeof State).type, children: [] });

  for (const [state, node] of nodes) {
    const parent = parents.get(state);
    const owner = parent && nodes.get(parent);
    if (owner) owner.children.push(node);
    else out.push(node);
  }

  return out;
}

export function get(address?: string): unknown {
  if (!address) return models();
  const { target, path } = parsePath(address);
  return find(target)?.get(path);
}

export function set(address: string, value: unknown): void {
  const { target, path } = parsePath(address);
  const instance = find(target);
  if (!instance || !path) throw new Error(`No model at ${address}.`);

  const dot = path.lastIndexOf('.');
  const key = path.slice(dot + 1);
  const owner = dot < 0 ? instance.state : walk(instance.state, path.slice(0, dot));

  if (owner == null || typeof owner !== 'object') throw new Error(`No model at ${address}.`);

  if (owner instanceof Map) owner.set(key, value);
  else (owner as Record<string, unknown>)[key] = value;
}

export async function call(address: string, ...args: unknown[]): Promise<unknown> {
  const { target, path } = parsePath(address);
  const state = find(target)?.state;
  const method = state && path && (state as unknown as Record<string, unknown>)[path];

  if (typeof method !== 'function') throw new Error(`No method at ${address}.`);

  return serialize(await method.apply(state, args));
}

export function wrapAll(): void {
  for (const state of registered()) wrap(state);
}

/** Observe the host commit: adapters call `mount?.()` once an instance is placed. */
function mounts(state: State) {
  const target = state as State & { mount?: (...args: unknown[]) => unknown };
  const original = target.mount;

  Object.defineProperty(target, 'mount', {
    configurable: true,
    writable: true,
    value(this: unknown, ...args: unknown[]) {
      claim(state);
      return typeof original === 'function' ? original.apply(this, args) : undefined;
    }
  });
}

function describe(state: State, parents: Map<State, State>): Model {
  const stored = entries(state);
  const declared = Object.entries(Object.getOwnPropertyDescriptors(state))
    .filter(([, desc]) => typeof desc.get === 'function')
    .map(([key]) => key);
  const model: Model = {
    id: String(state),
    ...seen(state.constructor as typeof State),
    keys: [...stored.keys()],
    absent: declared.filter((key) => !stored.has(key))
  };
  const parent = parents.get(state);
  if (parent) model.parent = String(parent);
  return model;
}

function wrap(state: State) {
  if (wrapped.has(state)) return;
  wrapped.add(state);

  const target = state as unknown as Record<string, Function>;
  const seenKeys = new Set<string>(['render']);

  for (let proto = Object.getPrototypeOf(state); proto !== State.prototype; proto = Object.getPrototypeOf(proto))
    for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
      if (seenKeys.has(key) || typeof desc.get !== 'function' || desc.get !== desc.set) continue;

      seenKeys.add(key);

      const original = target[key];

      target[key] = function (this: unknown, ...args: unknown[]) {
        noteCall(state, key, args);
        return original.apply(this, args);
      };
    }
}

function ownership(): Map<State, State> {
  if (cached?.version !== version) {
    const parents = new Map<State, State>();

    for (const owner of registered())
      for (const [key, value] of entries(owner)) {
        const field = Object.getOwnPropertyDescriptor(owner, key)?.enumerable;
        if (field || !(value instanceof State)) own(parents, owner, value);
      }

    cached = { version, parents };
  }

  return cached.parents;
}

function own(parents: Map<State, State>, owner: State, value: unknown) {
  if (value instanceof State) {
    if (!parents.has(value) && value !== owner) parents.set(value, owner);
  } else if (value && typeof value === 'object' && Symbol.iterator in value) {
    const items = value instanceof Map ? value.values() : (value as Iterable<unknown>);
    for (const item of items) if (item instanceof State) own(parents, owner, item);
  }
}
