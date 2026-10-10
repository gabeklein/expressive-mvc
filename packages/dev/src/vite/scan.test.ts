import { describe, expect, it } from "vitest";

import { scanSidecar } from "./scan";

const scan = (source: string) => scanSidecar(source, "remote.ts");

describe("sidecar scan", () => {
  it("will allow exported async functions, however declared", () => {
    expect(scan(`
      export async function a() {}
      export const b = async () => 1, c = async function () {};
      const d = async (x: number) => x;
      async function e() {}
      export { d, e as f };
    `)).toEqual({ calls: ["a", "b", "c", "d", "f"], classes: [], problems: [] });
  });

  it("will ignore types", () => {
    expect(scan(`
      export interface A {}
      export type B = string;
      type C = number;
      export type { C };
      export async function d(): Promise<A> { return {} }
    `)).toEqual({ calls: ["d"], classes: [], problems: [] });
  });

  it("will take an exported subclass as an error class", () => {
    expect(scan(`
      export class A extends Error {}
      export const B = class extends A {};
      class C extends RangeError {}
      export { C };
    `)).toEqual({ calls: [], classes: ["A", "B", "C"], problems: [] });
  });

  it("will refuse an export that is not an async function or a subclass", () => {
    const { calls, classes, problems } = scan(`
      export function a() {}
      export const b = () => 1, c = 1;
      export const { d } = { d: 1 };
      const e = 1;
      export { e };
      export class F {}
      export enum G { H }
    `);

    expect(calls).toEqual([]);
    expect(classes).toEqual([]);
    expect(problems).toEqual([
      expect.stringMatching(/^a is neither an async function nor an Error subclass/),
      expect.stringMatching(/^b is neither/),
      expect.stringMatching(/^c is neither/),
      expect.stringMatching(/^A destructured export is neither/),
      expect.stringMatching(/^e is neither/),
      expect.stringMatching(/^F is neither/),
      "A sidecar exports async functions and Error subclasses only.",
    ]);
  });

  it("will refuse re-exports", () => {
    expect(scan(`export * from "./x"; export { y } from "./x";`).problems).toEqual([
      "A sidecar cannot re-export from another module.",
      "A sidecar cannot re-export from another module.",
    ]);
  });

  it("will take a default class as the seat, with its public async methods", () => {
    expect(scan(`
      export default class Tally extends State {
        static ttl = 60;
        static async reset() {}
        total = 0;
        get double() { return this.total * 2 }
        async add(by: number) {}
        private async secret() {}
        protected async guarded() {}
        async #hidden() {}
        async _internal() {}
        _helper() {}
        async use() {}
      }
    `)).toEqual({ calls: [], classes: [], seat: { name: "Tally", methods: ["add"] }, problems: [] });
  });

  it("will take a default class however exported", () => {
    expect(scan(`class A extends State {} export { A as default }`).seat).toEqual({ name: "A", methods: [] });
    expect(scan(`class B extends State {} export default B`).seat).toEqual({ name: "B", methods: [] });
    expect(scan(`export default class extends State {}`).seat).toEqual({ name: "default", methods: [] });
  });

  it("will refuse a public method that is not async", () => {
    expect(scan(`export default class Tally extends State { add() {} }`).problems).toEqual([
      "Tally.add() is not async - every call to it crosses the wire.",
    ]);
  });

  it("will refuse a default that is not a subclass", () => {
    const problem = "A remote default is a State subclass - its methods are what the client calls.";

    expect(scan(`export default async () => {}`).problems).toEqual([problem]);
    expect(scan(`export default class {}`).problems).toEqual([problem]);
  });

  it("will refuse a default outside the folder's remote entry", () => {
    expect(scanSidecar(`export default class A extends State {}`, "remote/bar.ts", false).problems).toEqual([
      "Only a folder's remote entry - remote.ts or remote/index.ts - may export a default.",
    ]);
  });

  it("will report a syntax error", () => {
    expect(scan("export async function (").problems[0]).toBe("Expected function name");
  });
});
