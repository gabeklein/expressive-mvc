import { randomBytes } from "node:crypto";
import type { State } from "@expressive/mvc";

interface Tracker {
  generation: string;
  counter: number;
  dirty: boolean;
  keys: Map<string, number>;
}

const trackers = new WeakMap<State, Tracker>();

export function track(instance: State): void {
  const tracker: Tracker = { generation: randomBytes(6).toString("base64url"), counter: 0, dirty: false, keys: new Map() };
  const settle = () => { tracker.dirty = false; };

  trackers.set(instance, tracker);
  instance.set(key => {
    if (typeof key != "string") return;

    if (!tracker.dirty) {
      tracker.counter++;
      tracker.dirty = true;
    }

    tracker.keys.set(key, tracker.counter);
    return settle;
  });
}

export function versionOf(instance: State): string {
  const { generation, counter } = trackers.get(instance)!;
  return `${generation}:${counter}`;
}

export function changedSince(instance: State, version: string | undefined, fields: string[]): string[] {
  const tracker = trackers.get(instance)!;
  const [generation, counter] = version?.split(":") ?? [];

  if (generation !== tracker.generation) return fields;

  const since = Number(counter);
  return fields.filter(field => (tracker.keys.get(field) ?? 0) > since);
}

export function snapshot(instance: State, fields: string[]): Record<string, unknown> {
  return Object.fromEntries(fields.map(field => [field, (instance as any)[field]]));
}
