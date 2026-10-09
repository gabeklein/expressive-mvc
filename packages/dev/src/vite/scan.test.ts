import { describe, expect, it } from "vitest";

import { scanSidecar } from "./scan";

const scan = (source: string) => scanSidecar(source, "api.ts");

describe("sidecar scan", () => {
  it("will allow exported async functions, however declared", () => {
    expect(scan(`
      export async function a() {}
      export const b = async () => 1, c = async function () {};
      const d = async (x: number) => x;
      async function e() {}
      export { d, e as f };
    `)).toEqual({ calls: ["a", "b", "c", "d", "f"], errors: [] });
  });

  it("will ignore types", () => {
    expect(scan(`
      export interface A {}
      export type B = string;
      type C = number;
      export type { C };
      export async function d(): Promise<A> { return {} }
    `)).toEqual({ calls: ["d"], errors: [] });
  });

  it("will refuse an export that is not an async function", () => {
    const { calls, errors } = scan(`
      export function a() {}
      export const b = () => 1, c = 1;
      export const { d } = { d: 1 };
      const e = 1;
      export { e };
      export class F {}
    `);

    expect(calls).toEqual([]);
    expect(errors).toEqual([
      expect.stringMatching(/^a is not an async function/),
      expect.stringMatching(/^b is not an async function/),
      expect.stringMatching(/^c is not an async function/),
      expect.stringMatching(/^A destructured export is not an async function/),
      expect.stringMatching(/^e is not an async function/),
      "A sidecar exports async functions only.",
    ]);
  });

  it("will refuse re-exports and a default export", () => {
    expect(scan(`export * from "./x"; export { y } from "./x"; export default async () => {}`).errors).toEqual([
      "A sidecar cannot re-export from another module.",
      "A sidecar cannot re-export from another module.",
      "A sidecar's default export is not supported yet.",
    ]);
  });

  it("will report a syntax error", () => {
    expect(scan("export async function (").errors[0]).toBe("Expected function name");
  });
});
