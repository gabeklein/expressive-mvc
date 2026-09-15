import { State } from '@expressive/mvc';

import { journal, note, noteCall, noteDestroy, recordsCalls } from './journal';
import { entries, parsePath, serialize, walk } from './serialize';

export interface Model {
  id: string;
  type: string;
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

export function attach(Type: typeof State = State): () => void {
  if (!hooks.has(Type))
    hooks.set(
      Type,
      Type.on(function (this: State) {
        const self = this.is;
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
}

export function find(target: string): State | undefined {
  const byId = live.get(target);
  if (byId) return byId;
  for (const state of live.values())
    if (state.constructor.name === target) return state;
  return undefined;
}

export function models(): Model[] {
  const parents = ownership();
  return [...live.values()].map((state) => {
    const stored = entries(state);
    const declared = Object.entries(Object.getOwnPropertyDescriptors(state))
      .filter(([, desc]) => typeof desc.get === 'function')
      .map(([key]) => key);
    const model: Model = {
      id: String(state),
      type: state.constructor.name,
      keys: [...stored.keys()],
      absent: declared.filter((key) => !stored.has(key))
    };
    const parent = parents.get(state);
    if (parent) model.parent = String(parent);
    return model;
  });
}

export function tree(): Node[] {
  const parents = ownership();
  const nodes = new Map<State, Node>();
  const roots: Node[] = [];

  for (const state of live.values())
    nodes.set(state, { id: String(state), type: state.constructor.name, children: [] });

  for (const [state, node] of nodes) {
    const parent = parents.get(state);
    const owner = parent && nodes.get(parent);
    if (owner) owner.children.push(node);
    else roots.push(node);
  }

  return roots;
}

export function get(address?: string): unknown {
  if (!address) return models();
  const { target, path } = parsePath(address);
  const state = find(target);
  if (!state) return undefined;
  return serialize(walk(state, path));
}

export function set(address: string, value: unknown): void {
  const { target, path } = parsePath(address);
  const state = find(target);
  if (!state || !path) throw new Error(`No model at ${address}.`);

  const dot = path.lastIndexOf('.');
  const key = path.slice(dot + 1);
  const owner = dot < 0 ? state : walk(state, path.slice(0, dot));

  if (owner == null || typeof owner !== 'object') throw new Error(`No model at ${address}.`);

  if (owner instanceof Map) owner.set(key, value);
  else (owner as Record<string, unknown>)[key] = value;
}

export async function call(address: string, ...args: unknown[]): Promise<unknown> {
  const { target, path } = parsePath(address);
  const state = find(target);
  const method = state && path && (state as unknown as Record<string, unknown>)[path];

  if (typeof method !== 'function') throw new Error(`No method at ${address}.`);

  return serialize(await method.apply(state, args));
}

export function wrapAll(): void {
  for (const state of live.values()) wrap(state);
}

function wrap(state: State) {
  if (wrapped.has(state)) return;
  wrapped.add(state);

  const target = state as unknown as Record<string, Function>;
  const seen = new Set<string>(['render']);

  for (let proto = Object.getPrototypeOf(state); proto !== State.prototype; proto = Object.getPrototypeOf(proto))
    for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
      if (seen.has(key) || typeof desc.get !== 'function' || desc.get !== desc.set) continue;

      seen.add(key);

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
