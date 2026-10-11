import { afterEach, describe, expect, it, vi } from "vitest";

import { State } from "@expressive/mvc";

import { catchUp, connect, frameOf, hold, release, renew, twinOf } from "./connection";
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

  it("will accept a twin id of word characters, $ and -", () => {
    expect(twinOf("Tally-X7K2QF")).toBe("Tally-X7K2QF");
    expect(twinOf("$Tally_1")).toBe("$Tally_1");
    expect(twinOf("a,b")).toBeUndefined();
    expect(twinOf("")).toBeUndefined();
    expect(twinOf("x".repeat(81))).toBeUndefined();
    expect(twinOf(1)).toBeUndefined();
  });

  it("will release the twins named", () => {
    const connection = connect(crypto.randomUUID())!;

    hold(connection, "A", "/tally", tracked(), ["total"]);
    hold(connection, "B", "/tally", tracked(), ["total"]);
    release(connection, undefined);
    release(connection, "A,C");

    expect([...connection.twins.keys()]).toEqual(["B"]);
  });

  it("will catch a twin up from its seen version", async () => {
    const connection = connect(crypto.randomUUID())!;
    const tally = tracked();
    hold(connection, "A", "/tally", tally, ["total"]);

    expect(catchUp(connection, "A").values).toEqual({ total: 0 });
    expect(catchUp(connection, "A").values).toEqual({});

    tally.total = 2;
    await tally.set();

    expect(catchUp(connection, "A").values).toEqual({ total: 2 });
  });

  it("will frame only the twins past their seen version", async () => {
    const connection = connect(crypto.randomUUID())!;
    const b = tracked();

    hold(connection, "A", "/a", tracked(), ["total"]);
    hold(connection, "B", "/b", b, ["total"]);
    catchUp(connection, "A");
    catchUp(connection, "B");

    b.total = 1;
    await b.set();

    expect(frameOf(connection)).toEqual({ B: { patch: { total: 1 }, version: expect.any(String) } });
    expect(frameOf(connection)).toEqual({});
  });

  it("will renew every twin at an address with its new instance, sent whole", () => {
    const connection = connect(crypto.randomUUID())!;
    const next = tracked();

    hold(connection, "A", "/a", tracked(), ["total"]);
    hold(connection, "B", "/a", tracked(), ["total"]);
    hold(connection, "C", "/c", tracked(), ["total"]);
    frameOf(connection);

    renew(connection, "/a", next);

    expect(connection.twins.get("A")!.instance).toBe(next);
    expect(frameOf(connection)).toEqual({
      A: { patch: { total: 0 }, version: expect.any(String) },
      B: { patch: { total: 0 }, version: expect.any(String) },
    });
  });
});
