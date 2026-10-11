import { describe, expect, it } from "vitest";
import { State } from "@expressive/mvc";

import { changedSince, snapshot, track, versionOf } from "./version";

class Tally extends State {
  total = 0;
  label = "";
  get double() { return this.total * 2; }
}

const FIELDS = ["total", "label", "double"];

describe("versions", () => {
  it("will advance per flush and stamp the keys that changed", async () => {
    const tally = Tally.new();
    track(tally);
    snapshot(tally, FIELDS);

    const counter = (version: string) => Number(version.split(":")[1]);
    const first = versionOf(tally);
    expect(first).toMatch(/^[\w-]{8}:\d+$/);

    tally.total = 1;
    tally.label = "one";
    await tally.set();

    const second = versionOf(tally);
    expect(counter(second)).toBeGreaterThan(counter(first));
    expect(changedSince(tally, first, FIELDS)).toEqual(["total", "label", "double"]);

    tally.label = "uno";
    await tally.set();

    expect(counter(versionOf(tally))).toBeGreaterThan(counter(second));
    expect(changedSince(tally, second, FIELDS)).toEqual(["label"]);
    expect(changedSince(tally, versionOf(tally), FIELDS)).toEqual([]);
  });

  it("will treat an unknown or foreign generation as everything changed", () => {
    const tally = Tally.new();
    track(tally);

    expect(changedSince(tally, undefined, FIELDS)).toEqual(FIELDS);
    expect(changedSince(tally, "other:9", FIELDS)).toEqual(FIELDS);
  });

  it("will snapshot the fields named, getters included", () => {
    const tally = Tally.new();
    tally.total = 3;

    expect(snapshot(tally, ["total", "double"])).toEqual({ total: 3, double: 6 });
  });
});
