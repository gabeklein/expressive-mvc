import { randomBytes } from "node:crypto";
import type { State } from "@expressive/mvc";

import { changedSince, snapshot, versionOf } from "./version";

interface Slot {
  address: string;
  instance: State;
  fields: string[];
  seen?: string;
}

export interface Connection {
  epoch: string;
  slots: Map<number, Slot>;
  next: number;
  timer?: ReturnType<typeof setTimeout>;
}

export type Frame = Record<number, { patch: Record<string, unknown>; version: string }>;

const TTL = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const connections = new Map<string, Connection>();

export function connect(id: unknown): Connection | undefined {
  if (typeof id != "string" || !UUID.test(id)) return;

  let connection = connections.get(id);

  if (!connection) {
    connection = { epoch: randomBytes(6).toString("base64url"), slots: new Map(), next: 0 };
    connections.set(id, connection);
  }

  clearTimeout(connection.timer);
  connection.timer = setTimeout(() => connections.delete(id), TTL * 1000);
  connection.timer.unref();

  return connection;
}

export function release(connection: Connection, slots: unknown): void {
  if (typeof slots != "string") return;

  for (const slot of slots.split(",")) connection.slots.delete(Number(slot));
}

export function open(connection: Connection, address: string, instance: State, fields: string[], seen?: string): number {
  const slot = ++connection.next;

  connection.slots.set(slot, { address, instance, fields, seen });

  return slot;
}

export function renew(connection: Connection, address: string, instance: State, slot?: unknown, seen?: string): void {
  for (const [at, held] of connection.slots) {
    if (held.address !== address) continue;

    held.instance = instance;
    if (String(at) === slot) held.seen = seen;
  }
}

export function catchUp(connection: Connection, slot: number): { values: Record<string, unknown>; version: string } {
  const held = connection.slots.get(slot)!;
  const { instance, fields } = held;

  snapshot(instance, fields);

  const values = snapshot(instance, changedSince(instance, held.seen, fields));
  held.seen = versionOf(instance);

  return { values, version: held.seen };
}

export function frameOf(connection: Connection): Frame {
  const frame: Frame = {};

  for (const [slot, held] of connection.slots) {
    snapshot(held.instance, held.fields);
    if (versionOf(held.instance) === held.seen) continue;

    const { values, version } = catchUp(connection, slot);
    frame[slot] = { patch: values, version };
  }

  return frame;
}
