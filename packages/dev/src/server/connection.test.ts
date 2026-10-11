import { afterEach, describe, expect, it, vi } from "vitest";

import { State } from "@expressive/mvc";

import { catchUp, connect, frameOf, open, release, renew } from "./connection";
import { track } from "./version";

class Tally extends State {
  total = 0;
}

function tracked() {
  const tally = Tally.new();
  track(tally);
  return tally;
}

describe("connection", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("will not connect without a UUID", () => {
    expect(connect(undefined)).toBeUndefined();
    expect(connect("tab")).toBeUndefined();
    expect(connect(["a"])).toBeUndefined();
  });

  it("will keep one connection per id", () => {
    const id = crypto.randomUUID();

    expect(connect(id)).toBe(connect(id));
    expect(connect(id)).not.toBe(connect(crypto.randomUUID()));
  });

  it("will expire an idle connection, its id opening a new epoch", () => {
    vi.useFakeTimers();
    const id = crypto.randomUUID();
    const { epoch } = connect(id)!;

    vi.advanceTimersByTime(299_000);
    expect(connect(id)!.epoch).toBe(epoch);

    vi.advanceTimersByTime(299_000);
    expect(connect(id)!.epoch).toBe(epoch);

    vi.advanceTimersByTime(300_000);
    expect(connect(id)!.epoch).not.toBe(epoch);
  });

  it("will release only the slots it holds", () => {
    const connection = connect(crypto.randomUUID())!;
    const slot = open(connection, "/tally", tracked(), ["total"]);

    release(connection, undefined);
    release(connection, `${slot},7`);

    expect(connection.slots.size).toBe(0);
    expect(open(connection, "/tally", tracked(), ["total"])).toBe(slot + 1);
  });

  it("will catch a slot up from its seen version", async () => {
    const connection = connect(crypto.randomUUID())!;
    const tally = tracked();
    const slot = open(connection, "/tally", tally, ["total"]);

    expect(catchUp(connection, slot).values).toEqual({ total: 0 });
    expect(catchUp(connection, slot).values).toEqual({});

    tally.total = 2;
    await tally.set();

    expect(catchUp(connection, slot).values).toEqual({ total: 2 });
  });

  it("will frame only the slots past their seen version", async () => {
    const connection = connect(crypto.randomUUID())!;
    const a = tracked();
    const b = tracked();

    catchUp(connection, open(connection, "/a", a, ["total"]));
    catchUp(connection, open(connection, "/b", b, ["total"]));

    b.total = 1;
    await b.set();

    expect(frameOf(connection)).toEqual({ 2: { patch: { total: 1 }, version: expect.any(String) } });
    expect(frameOf(connection)).toEqual({});
  });

  it("will renew every slot at an address with its new instance, and the named slot's seen version", () => {
    const connection = connect(crypto.randomUUID())!;
    const a = open(connection, "/a", tracked(), ["total"]);
    const b = open(connection, "/a", tracked(), ["total"]);
    const c = open(connection, "/c", tracked(), ["total"]);
    const next = tracked();

    catchUp(connection, a);
    catchUp(connection, b);
    catchUp(connection, c);
    const { version } = catchUp(connection, a);

    renew(connection, "/a", next, String(b), version);
    renew(connection, "/b", tracked());

    expect(connection.slots.get(a)!.instance).toBe(next);
    expect(connection.slots.get(b)!.instance).toBe(next);
    expect(connection.slots.get(b)!.seen).toBe(version);
    expect(frameOf(connection)).toEqual({
      [a]: { patch: { total: 0 }, version: expect.any(String) },
      [b]: { patch: { total: 0 }, version: expect.any(String) },
    });
  });
});
