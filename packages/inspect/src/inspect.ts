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

const live = new Map<string, State>();
const hooks = new Map<typeof State, () => boolean>();
const wrapped = new WeakSet<State>();

/** Navigable view of one live instance - identity, ownership, reads, observation. */
export class Handle {
  constructor(readonly state: State) {}

  get id() {
    return String(this.state);
  }

  get type() {
    return seen(this.state.constructor as typeof State).type;
  }

  get parent(): Handle | undefined {
    const owner = ownership().get(this.state);
    return owner && new Handle(owner);
  }

  get children(): Handle[] {
    const parents = ownership();
    return [...live.values()]
      .filter((state) => parents.get(state) === this.state)
      .map((state) => new Handle(state));
  }

  /** First handle in this subtree, depth-first, matching `where` (a label or predicate). */
  find(where: string | ((handle: Handle) => boolean)): Handle | undefined {
    const test = typeof where === 'string' ? (h: Handle) => h.type === where : where;
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

  /** Call `fn` on each update; `keys` narrows. Returns unsubscribe. */
  watch(fn: (key: string) => void, keys?: string[]): () => void {
    const stop = this.state.set((key) => {
      if (typeof key !== 'string' || (keys && !keys.includes(key))) return;
      fn(key);
    });
    return () => void stop();
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
        if (recordsCalls()) wrap(self);
        const stop = self.set((key) => note(self, key));
        return () => {
          stop();
          live.delete(String(self));
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
  journal.reset();
  forget();
}

/** Resolve an id or label to a handle. */
export function find(target: string): Handle | undefined {
  const byId = live.get(target);
  if (byId) return new Handle(byId);
  for (const state of live.values())
    if (seen(state.constructor as typeof State).type === target) return new Handle(state);
  return undefined;
}

export function handles(): Handle[] {
  return [...live.values()].map((state) => new Handle(state));
}

export function roots(): Handle[] {
  const parents = ownership();
  return handles().filter((handle) => !parents.has(handle.state));
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
  const handle = find(target);
  if (!handle || !path) throw new Error(`No model at ${address}.`);

  const dot = path.lastIndexOf('.');
  const key = path.slice(dot + 1);
  const owner = dot < 0 ? handle.state : walk(handle.state, path.slice(0, dot));

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
  const parents = new Map<State, State>();

  for (const owner of live.values())
    for (const value of entries(owner).values()) claim(parents, owner, value);

  return parents;
}

function claim(parents: Map<State, State>, owner: State, value: unknown) {
  if (value instanceof State) {
    if (!parents.has(value) && value !== owner) parents.set(value, owner);
  } else if (value && typeof value === 'object' && Symbol.iterator in value) {
    const items = value instanceof Map ? value.values() : (value as Iterable<unknown>);
    for (const item of items) if (item instanceof State) claim(parents, owner, item);
  }
}
