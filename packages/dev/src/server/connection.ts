import { randomBytes } from "node:crypto";
import type { State } from "@expressive/mvc";

import { changedSince, snapshot, versionOf, watch } from "./version";

interface Held {
  address: string;
  instance: State;
  fields: string[];
  seen?: string;
  stop: () => void;
  pool?: Pool;
}

export interface Pool {
  id: string;
  drop(): void;
  current(): boolean;
}

export type Sink = (event: string, data: unknown) => void;

export interface Connection {
  id: string;
  epoch: string;
  twins: Map<string, Held>;
  sink?: Sink;
  busy: number;
  queued: boolean;
  scheduled: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

export type Frame = Record<string, { patch: Record<string, unknown>; version: string }>;

const TTL = 300;
const BEAT = 15;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TWIN = /^[\w$-]{1,80}$/;

const connections = new Map<string, Connection>();

export function connect(id: unknown): Connection | undefined {
  if (typeof id != "string" || !UUID.test(id)) return;

  let connection = connections.get(id);

  if (!connection) {
    connection = { id, epoch: randomBytes(6).toString("base64url"), twins: new Map(), busy: 0, queued: false, scheduled: false };
    connections.set(id, connection);
  }

  expire(connection);

  return connection;
}

function expire(connection: Connection): void {
  clearTimeout(connection.timer);

  if (connection.sink) return;

  connection.timer = setTimeout(() => {
    connections.delete(connection.id);
    release(connection, [...connection.twins.keys()].join(","));
  }, TTL * 1000);
  connection.timer.unref();
}

export function listen(connection: Connection, sink: Sink): () => void {
  const beat = setInterval(() => sink("beat", { sum: checksum(connection) }), BEAT * 1000);

  beat.unref();
  connection.sink = sink;
  clearTimeout(connection.timer);
  sink("hello", { epoch: connection.epoch });
  announce(connection);

  return () => {
    clearInterval(beat);

    if (connection.sink !== sink) return;

    connection.sink = undefined;
    expire(connection);
  };
}

export function begin(connection: Connection): void {
  connection.busy++;
}

export function end(connection: Connection): void {
  if (--connection.busy || !connection.queued) return;

  connection.queued = false;
  announce(connection);
}

function announce(connection: Connection): void {
  if (!connection.sink || connection.scheduled) return;

  connection.scheduled = true;
  queueMicrotask(() => {
    connection.scheduled = false;

    if (connection.busy) return void (connection.queued = true);

    const stale = staleOf(connection);
    if (Object.keys(stale).length) connection.sink?.("stale", stale);
  });
}

export function staleOf(connection: Connection): Record<string, string[]> {
  const stale: Record<string, string[]> = {};

  for (const [twin, { instance, seen, fields }] of connection.twins) {
    const keys = changedSince(instance, seen, fields);
    if (keys.length) stale[twin] = keys;
  }

  return stale;
}

export function checksum(connection: Connection): number {
  let sum = 0;

  for (const [twin, { seen }] of connection.twins) if (seen) sum = (sum ^ fnv(`${twin}@${seen}`)) >>> 0;

  return sum;
}

function fnv(text: string): number {
  let hash = 0x811c9dc5;

  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);

  return hash >>> 0;
}

export function twinOf(id: unknown): string | undefined {
  return typeof id == "string" && TWIN.test(id) ? id : undefined;
}

export function release(connection: Connection, twins: unknown): void {
  if (typeof twins != "string") return;

  for (const twin of twins.split(",")) {
    const held = connection.twins.get(twin);

    held?.stop();
    held?.pool?.drop();
    connection.twins.delete(twin);
  }
}

export function hold(connection: Connection, twin: string, address: string, instance: State, fields: string[], seen?: string, pool?: Pool): void {
  const held = connection.twins.get(twin);

  held?.stop();
  connection.twins.set(twin, { address, instance, fields, seen, pool, stop: watch(instance, () => announce(connection)) });
}

export function renew(connection: Connection, address: string, instance: State): void {
  for (const held of connection.twins.values()) {
    if (held.pool || held.address !== address || held.instance === instance) continue;

    held.stop();
    held.instance = instance;
    held.stop = watch(instance, () => announce(connection));
  }
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
