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

  it("will refuse re-exports and a default export", () => {
    expect(scan(`export * from "./x"; export { y } from "./x"; export default async () => {}`).problems).toEqual([
      "A sidecar cannot re-export from another module.",
      "A sidecar cannot re-export from another module.",
      "A sidecar's default export is not supported yet.",
    ]);
  });

  it("will report a syntax error", () => {
    expect(scan("export async function (").problems[0]).toBe("Expected function name");
  });
});
