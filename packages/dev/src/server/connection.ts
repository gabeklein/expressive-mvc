import { randomBytes } from "node:crypto";
import type { State } from "@expressive/mvc";

import { changedSince, snapshot, versionOf } from "./version";

interface Held {
  address: string;
  instance: State;
  fields: string[];
  seen?: string;
}

export interface Connection {
  epoch: string;
  twins: Map<string, Held>;
  timer?: ReturnType<typeof setTimeout>;
}

export type Frame = Record<string, { patch: Record<string, unknown>; version: string }>;

const TTL = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TWIN = /^[\w$-]{1,80}$/;

const connections = new Map<string, Connection>();

export function connect(id: unknown): Connection | undefined {
  if (typeof id != "string" || !UUID.test(id)) return;

  let connection = connections.get(id);

  if (!connection) {
    connection = { epoch: randomBytes(6).toString("base64url"), twins: new Map() };
    connections.set(id, connection);
  }

  clearTimeout(connection.timer);
  connection.timer = setTimeout(() => connections.delete(id), TTL * 1000);
  connection.timer.unref();

  return connection;
}

export function twinOf(id: unknown): string | undefined {
  return typeof id == "string" && TWIN.test(id) ? id : undefined;
}

export function release(connection: Connection, twins: unknown): void {
  if (typeof twins != "string") return;

  for (const twin of twins.split(",")) connection.twins.delete(twin);
}

export function hold(connection: Connection, twin: string, address: string, instance: State, fields: string[], seen?: string): void {
  connection.twins.set(twin, { address, instance, fields, seen });
}

export function renew(connection: Connection, address: string, instance: State): void {
  for (const held of connection.twins.values()) if (held.address === address) held.instance = instance;
}

export function catchUp(connection: Connection, twin: string): { values: Record<string, unknown>; version: string } {
  const held = connection.twins.get(twin)!;
  const { instance, fields } = held;

  snapshot(instance, fields);

  const values = snapshot(instance, changedSince(instance, held.seen, fields));
  held.seen = versionOf(instance);

  return { values, version: held.seen };
}

export function frameOf(connection: Connection): Frame {
  const frame: Frame = {};

  for (const [twin, held] of connection.twins) {
    snapshot(held.instance, held.fields);
    if (versionOf(held.instance) === held.seen) continue;

    const { values, version } = catchUp(connection, twin);
    frame[twin] = { patch: values, version };
  }

  return frame;
}
