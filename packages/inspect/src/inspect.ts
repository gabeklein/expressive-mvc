import { State } from '@expressive/mvc';

import { act as run, journal, note, noteCall, noteDestroy, recordsCalls, type Frame, type Query } from './journal';
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
}

const live = new Map<string, State>();
const hooks = new Map<typeof State, () => boolean>();
const wrapped = new WeakSet<State>();
const wrappers = new WeakMap<State, Instance>();
const spans = new WeakMap<State, Span>();

let version = 0;
let cached: { version: number; parents: Map<State, State> } | undefined;

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
    return live.get(this.id) === this.state;
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
    return [...live.values()]
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
  if (!hooks.has(Type))
    hooks.set(
      Type,
      Type.on(function (this: State) {
        const self = this.is;
        seen(self.constructor as typeof State);
        live.set(String(self), self);
        spans.set(self, { since: Date.now() });
        version++;
        if (recordsCalls()) wrap(self);
        const stop = self.set((key) => {
          const store = entries(self);
          if (typeof key === 'string' && typeof store.get(key) === 'object') version++;
          note(self, key, store);
        });
        return () => {
          stop();
          live.delete(String(self));
          spans.get(self)!.until = Date.now();
          version++;
          noteDestroy(self);
        };
      })
    );

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
  journal.reset();
  forget();
}

/** Resolve an id or label to a instance. */
export function find(target: string): Instance | undefined {
  const byId = live.get(target);
  if (byId) return Instance.of(byId);
  for (const state of live.values())
    if (seen(state.constructor as typeof State).type === target) return Instance.of(state);
  return undefined;
}

export function instances(): Instance[] {
  return [...live.values()].map(Instance.of);
}

export function roots(): Instance[] {
  const parents = ownership();
  return instances().filter((instance) => !parents.has(instance.state));
}

export function models(): Model[] {
  const parents = ownership();
  return [...live.values()].map((state) => describe(state, parents));
}

export function tree(): Node[] {
  const parents = ownership();
  const nodes = new Map<State, Node>();
  const out: Node[] = [];

  for (const state of live.values())
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
  for (const state of live.values()) wrap(state);
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

    for (const owner of live.values())
      for (const value of entries(owner).values()) claim(parents, owner, value);

    cached = { version, parents };
  }

  return cached.parents;
}

function claim(parents: Map<State, State>, owner: State, value: unknown) {
  if (value instanceof State) {
    if (!parents.has(value) && value !== owner) parents.set(value, owner);
  } else if (value && typeof value === 'object' && Symbol.iterator in value) {
    const items = value instanceof Map ? value.values() : (value as Iterable<unknown>);
    for (const item of items) if (item instanceof State) claim(parents, owner, item);
  }
}
