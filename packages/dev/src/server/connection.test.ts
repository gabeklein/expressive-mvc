import { afterEach, describe, expect, it, vi } from "vitest";

import { State } from "@expressive/mvc";

import { begin, catchUp, checksum, connect, end, frameOf, hold, listen, release, renew, twinOf } from "./connection";
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

  it("will drop a pooled twin's instance on release, and every one when the connection expires", () => {
    vi.useFakeTimers();
    const id = crypto.randomUUID();
    const connection = connect(id)!;
    const drops = { A: vi.fn(), B: vi.fn() };
    const seat = tracked();

    const cart = tracked();

    hold(connection, "A", "/a", cart, ["total"], undefined, { id: "/a#Cart", drop: drops.A });
    hold(connection, "B", "/a", tracked(), ["total"], undefined, { id: "/a#Cart", drop: drops.B });
    hold(connection, "S", "/a", seat, ["total"]);

    renew(connection, "/a", tracked());
    expect(connection.twins.get("A")!.instance).toBe(cart);
    expect(connection.twins.get("S")!.instance).not.toBe(seat);

    release(connection, "A");
    expect(drops.A).toHaveBeenCalledOnce();
    expect(drops.B).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300_000);
    expect(drops.B).toHaveBeenCalledOnce();
    expect(connection.twins.size).toBe(0);
  });

  describe("stream", () => {
    const tick = () => new Promise(resolve => setTimeout(resolve));

    function streamed() {
      const connection = connect(crypto.randomUUID())!;
      const events: [string, any][] = [];
      const close = listen(connection, (event, data) => events.push([event, data]));

      return { connection, events, close };
    }

    it("will greet with the connection's epoch", () => {
      const { connection, events } = streamed();
      expect(events).toEqual([["hello", { epoch: connection.epoch }]]);
    });

    it("will name the stale keys of each twin past its seen version, once per flush", async () => {
      const { connection, events } = streamed();
      const tally = tracked();

      hold(connection, "A", "/a", tally, ["total"]);
      catchUp(connection, "A");
      await tick();

      tally.total = 1;
      tally.total = 2;
      await tick();

      expect(events.slice(1)).toEqual([["stale", { A: ["total"] }]]);
    });

    it("will hold announcements while the tab's own call runs, then send only what it did not receive", async () => {
      const { connection, events } = streamed();
      const tally = tracked();

      hold(connection, "A", "/a", tally, ["total"]);
      catchUp(connection, "A");
      begin(connection);
      begin(connection);

      tally.total = 1;
      await tick();
      end(connection);
      await tick();
      expect(events).toHaveLength(1);

      frameOf(connection);
      end(connection);
      await tick();
      expect(events).toHaveLength(1);

      begin(connection);
      tally.total = 2;
      await tick();
      end(connection);
      await tick();
      expect(events.slice(1)).toEqual([["stale", { A: ["total"] }]]);
    });

    it("will stop announcing a twin once released, and follow a renewed instance", async () => {
      const { connection, events } = streamed();
      const a = tracked();
      const b = tracked();
      const next = tracked();

      hold(connection, "A", "/a", a, ["total"]);
      hold(connection, "B", "/b", b, ["total"]);
      catchUp(connection, "A");
      catchUp(connection, "B");
      release(connection, "A");
      renew(connection, "/b", next);
      renew(connection, "/b", next);
      frameOf(connection);

      a.total = 1;
      b.total = 1;
      await tick();
      expect(events).toHaveLength(1);

      next.total = 1;
      await tick();
      expect(events.slice(1)).toEqual([["stale", { B: ["total"] }]]);
    });

    it("will beat every 15 seconds with a checksum of what each twin has seen", () => {
      vi.useFakeTimers();
      const { connection, events, close } = streamed();

      hold(connection, "A", "/a", tracked(), ["total"]);
      hold(connection, "B", "/b", tracked(), ["total"]);
      catchUp(connection, "A");

      vi.advanceTimersByTime(15_000);
      expect(events.at(-1)).toEqual(["beat", { sum: checksum(connection) }]);
      expect(checksum(connection)).not.toBe(0);

      close();
      vi.advanceTimersByTime(15_000);
      expect(events.filter(([event]) => event == "beat")).toHaveLength(1);
    });

    it("will keep the connection while its stream is open, and expire it after", () => {
      vi.useFakeTimers();
      const id = crypto.randomUUID();
      const connection = connect(id)!;
      const close = listen(connection, () => {});

      connect(id);
      vi.advanceTimersByTime(600_000);
      expect(connect(id)).toBe(connection);

      close();
      vi.advanceTimersByTime(300_000);
      expect(connect(id)).not.toBe(connection);
    });

    it("will let a newer stream take over without the older one's close undoing it", () => {
      const connection = connect(crypto.randomUUID())!;
      const first = listen(connection, () => {});
      const second = vi.fn();

      listen(connection, second);
      first();

      expect(connection.sink).toBe(second);
    });
  });
});

