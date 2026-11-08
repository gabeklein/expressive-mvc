import { describe, expect, it } from "vitest";

import { decode, encode, parse, stringify } from "./codec";

const trip = (value: unknown) => parse(stringify(value));

describe("encode", () => {
  it("will pass JSON's own values through", () => {
    const value = { a: 1, b: "two", c: true, d: null, e: [1, "x", false], f: { g: { h: [] } } };

    expect(encode(value)).toEqual(value);
    expect(stringify(value)).toBe(JSON.stringify(value));
  });

  it("will tag what JSON loses", () => {
    expect(encode(new Date("2026-11-08T12:00:00.000Z"))).toEqual({ $date: "2026-11-08T12:00:00.000Z" });
    expect(encode(new Date(NaN))).toEqual({ $date: null });
    expect(encode(12n)).toEqual({ $bigint: "12" });
    expect(encode([NaN, Infinity, -Infinity])).toEqual([{ $number: "NaN" }, { $number: "Infinity" }, { $number: "-Infinity" }]);
    expect(encode(new Map([["a", 1]]))).toEqual({ $map: [["a", 1]] });
    expect(encode(new Set([1, 2]))).toEqual({ $set: [1, 2] });
    expect(encode(new Uint8Array([104, 105]))).toEqual({ $binary: "aGk=" });
    expect(encode(new Uint8Array([104, 105]).buffer)).toEqual({ $binary: "aGk=" });
    expect(encode([undefined, 1])).toEqual([{ $undefined: 1 }, 1]);
  });

  it("will escape an object that would read as a tag", () => {
    expect(encode({ $date: "not one" })).toEqual({ $escape: { $date: "not one" } });
    expect(encode({ $date: "x", other: 1 })).toEqual({ $date: "x", other: 1 });
    expect(encode({ $child: 2 })).toEqual({ $child: 2 });
  });

  it("will drop what JSON drops, and use toJSON", () => {
    const fn = () => {};
    const sym = Symbol("s");

    expect(encode({ a: undefined, b: fn, c: sym, d: 1 })).toEqual({ d: 1 });
    expect(encode([fn, sym])).toEqual([null, null]);
    expect(encode({ toJSON: () => ({ when: new Date(0) }) })).toEqual({ when: { $date: "1970-01-01T00:00:00.000Z" } });
    expect(encode(undefined)).toBeUndefined();
    expect(encode("text")).toBe("text");
  });

  it("will refuse a circular structure, but not a value seen twice", () => {
    const shared = { n: 1 };
    const loop: Record<string, unknown> = {};

    loop.self = loop;

    expect(encode([shared, shared])).toEqual([{ n: 1 }, { n: 1 }]);
    expect(() => encode(loop)).toThrow("Cannot send a circular structure.");
  });
});

describe("decode", () => {
  it("will rebuild every tagged value", () => {
    const when = new Date("2026-11-08T12:00:00.000Z");
    const value = {
      when,
      never: new Date(NaN),
      big: 9007199254740993n,
      odd: [NaN, -Infinity],
      map: new Map<unknown, unknown>([[when, new Set(["x"])]]),
      bytes: new Uint8Array([0, 255, 7]),
      list: [undefined, null, 1],
      escaped: { $set: "plain" },
      nested: { deep: [{ at: when }] },
    };
    const back = trip(value) as typeof value;

    expect(back.when).toBeInstanceOf(Date);
    expect(back.when.getTime()).toBe(when.getTime());
    expect(Number.isNaN(back.never.getTime())).toBe(true);
    expect(back.big).toBe(9007199254740993n);
    expect(back.odd).toEqual([NaN, -Infinity]);
    expect([...back.map.keys()][0]).toEqual(when);
    expect([...back.map.values()][0]).toEqual(new Set(["x"]));
    expect(back.bytes).toEqual(new Uint8Array([0, 255, 7]));
    expect(back.list).toEqual([undefined, null, 1]);
    expect(1 in back.list && 0 in back.list).toBe(true);
    expect(back.escaped).toEqual({ $set: "plain" });
    expect(back.nested.deep[0].at).toEqual(when);
  });

  it("will read plain JSON as itself", () => {
    expect(decode({ a: [1, { b: "c" }], d: null })).toEqual({ a: [1, { b: "c" }], d: null });
    expect(decode("x")).toBe("x");
  });

  it("will keep an escaped object's tags as data, values decoded", () => {
    expect(decode({ $escape: { $date: { $date: "1970-01-01T00:00:00.000Z" } } })).toEqual({ $date: new Date(0) });
  });

  it("will carry large binary in chunks", () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 256);

    expect(trip(bytes)).toEqual(bytes);
  });
});
