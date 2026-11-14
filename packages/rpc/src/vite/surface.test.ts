import { describe, expect, it } from "vitest";

import type { Sources } from "./scan";
import { definition, leaves, scanSurface, type Tree } from "./surface";

const FILE = "/app/api/index.ts";

const MODULES: Record<string, string> = {
  "/app/api/claim/search.ts": `export async function search() {} export async function create() {} export class Missing extends Error {}`,
  "/app/api/attorney/search.ts": `async function find() {} export { find as search };`,
  "/app/api/claim/index.ts": `export { search as find } from "./search"; import { create } from "./search"; export { create as make }; export * from "../more";`,
  "/app/api/more.ts": `export * as nested from "./attorney/search"; export type * from "./attorney/search"; export type { Hidden } from "./attorney/search"; export async function extra() {}`,
  "/app/api/loop.ts": `export { a } from "./loop"; export * from "./loop";`,
  "/app/api/plain.ts": `export default async function () {}`,
  "/app/lib/helper.ts": `export async function help() {}`,
  "/app/api/outside.ts": `export { help } from "../lib/helper";`,
};

const sources = (others: Record<string, string>): Sources => ({
  resolve: async (spec, importer) => {
    const file = new URL(spec, `file://${importer}`).pathname + ".ts";
    return file in others ? file : undefined;
  },
  read: file => others[file],
});

function scan(source: string, others: Record<string, string> = {}) {
  return scanSurface(FILE, source, sources({ ...MODULES, ...others }), file => file.startsWith("/app/api/"));
}

const plain = (tree: Tree): unknown => Object.fromEntries([...tree].map(([key, value]) => [key, value instanceof Map ? plain(value) : value]));

describe("tree", () => {
  it("will take each leaf as the named export of the module defining it, grouped as the module groups them", async () => {
    const { tree, own, problems } = await scan(`
      import { Model } from "@expressive/mvc";
      import { search as searchClaims, create, Missing } from "./claim/search";
      import { search as searchAttorneys } from "./attorney/search";
      export default class Session extends Model {}
      export async function hello() {}
      export class Oops extends Error {}
      export const claim = { search: searchClaims, create, errors: { Missing } }, attorney = { search: searchAttorneys, "find-all": searchClaims };
    `);

    expect(problems).toEqual([]);
    expect(own).toEqual(["hello", "Oops"]);
    expect(plain(tree)).toEqual({
      claim: {
        search: { file: "/app/api/claim/search.ts", name: "search" },
        create: { file: "/app/api/claim/search.ts", name: "create" },
        errors: { Missing: { file: "/app/api/claim/search.ts", name: "Missing" } },
      },
      attorney: { search: { file: "/app/api/attorney/search.ts", name: "search" }, "find-all": { file: "/app/api/claim/search.ts", name: "search" } },
    });
  });

  it("will take an exported import or re-export as a leaf of its own", async () => {
    const { tree, own, problems } = await scan(`
      import { create } from "./claim/search";
      import { find as findClaim } from "./claim/index";
      const local = 1;
      export const group = {};
      export const made = create;
      export { findClaim, local };
      export { search as findAttorney } from "./attorney/search";
      export { type Hidden } from "./more";
    `);

    expect(problems).toEqual([]);
    expect(own).toEqual(["local"]);
    expect(plain(tree)).toEqual({
      group: {},
      made: { file: "/app/api/claim/search.ts", name: "create" },
      findClaim: { file: "/app/api/claim/search.ts", name: "search" },
      findAttorney: { file: "/app/api/attorney/search.ts", name: "search" },
    });
  });

  it("will follow re-exports, exported imports and star exports to the defining module", async () => {
    const { tree, problems } = await scan(`
      import { find, make, extra } from "./claim/index";
      export const claim = { find, make, extra };
    `);

    expect(problems).toEqual([]);
    expect(plain(tree)).toEqual({
      claim: {
        find: { file: "/app/api/claim/search.ts", name: "search" },
        make: { file: "/app/api/claim/search.ts", name: "create" },
        extra: { file: "/app/api/more.ts", name: "extra" },
      },
    });
  });

  it("will take a group through a local name, as const and satisfies, with types exported beside it", async () => {
    const { tree, problems } = await scan(`
      import { search } from "./claim/search";
      export type * as types from "./claim/search";
      export type { Thing } from "./things";
      export type Shape = typeof api;
      export interface Api {}
      const claims = { search } as const;
      const api = ({ claims }) satisfies object;
      export { api };
    `);

    expect(problems).toEqual([]);
    expect(plain(tree)).toEqual({ api: { claims: { search: { file: "/app/api/claim/search.ts", name: "search" } } } });
  });

  it("will collect each module's leaves", async () => {
    const { tree } = await scan(`
      import { search, create } from "./claim/search";
      import { search as other } from "./attorney/search";
      export const a = { b: search, c: { d: create, e: other, f: search } };
    `);

    expect(leaves(tree)).toEqual(new Map([
      ["/app/api/claim/search.ts", new Set(["search", "create"])],
      ["/app/api/attorney/search.ts", new Set(["search"])],
    ]));
  });
});

describe("problems", () => {
  it("will refuse export * and a declaration the client could not use", async () => {
    const { problems } = await scan(`export const api = {}; export * from "./claim/search"; export enum Kind { A } export const { a } = { a: 1 };`);

    expect(problems).toEqual([
      "A server module names each export - export * would hide which calls cross.",
      "A server module exports async functions and Error subclasses only.",
      "A destructured export is neither an async function nor an Error subclass - the client could not use it.",
    ]);
  });

  it("will refuse a key it cannot read without running the module", async () => {
    const { problems } = await scan(`
      import { search } from "./claim/search";
      const key = "k";
      const rest = {};
      export const api = { ...rest, [key]: search, nested: { run() {}, get value() { return 1; } } };
    `);

    expect(problems).toEqual([
      "api has a spread - a group's keys are written out, each an object or an imported name.",
      "api has a computed key - a group's keys are written out, each an object or an imported name.",
      "api.nested has a method - a group's keys are written out, each an object or an imported name.",
      "api.nested has a method - a group's keys are written out, each an object or an imported name.",
    ]);
  });

  it("will refuse a leaf that is not a value imported by name", async () => {
    const named = "a leaf is a function or Error class imported by name from the module under the folder that defines it.";
    const { problems } = await scan(`
      import * as claim from "./claim/search";
      import type { search } from "./claim/search";
      import plain from "./plain";
      async function local() {}
      export const api = { a: local, b: claim.search, c: 1, d: search, e: plain };
    `);

    expect(problems).toEqual([
      `api.a is not an imported name - ${named}`,
      `api.b is not an imported name - ${named}`,
      `api.c is not an imported name - ${named}`,
      `api.d is not an imported name - ${named}`,
      `api.e is a default export - ${named}`,
    ]);
  });

  it("will refuse a leaf it cannot find, or one defined outside the folder", async () => {
    const { problems } = await scan(`
      import { gone } from "./claim/search";
      import { search } from "./nowhere";
      import { a } from "./loop";
      import { help } from "./outside";
      export const api = { gone, search, a };
      export { help };
    `);

    expect(problems).toEqual([
      `api.gone is gone from "./claim/search", which does not export it.`,
      `api.search is search from "./nowhere", which does not export it.`,
      `api.a is a from "./loop", which does not export it.`,
      "help is defined outside the folder, in /app/lib/helper.ts - a leaf is a function or Error class imported by name from the module under the folder that defines it.",
    ]);
  });

  it("will report a syntax error", async () => {
    expect((await scan("export const api = {")).problems[0]).toMatch(/Expected|Unexpected/);
  });
});

describe("definition", () => {
  it("will skip type-only and namespace re-exports while it looks", async () => {
    const found = (name: string) => definition("/app/api/more.ts", name, sources(MODULES));

    expect(await found("extra")).toEqual({ file: "/app/api/more.ts", name: "extra" });
    expect(await found("Hidden")).toBeUndefined();
    expect(await found("search")).toBeUndefined();
  });

  it("will skip a type-only specifier, and a star export it cannot resolve", async () => {
    const others = { ...MODULES, "/app/api/typed.ts": `import { search } from "./claim/search"; export { type search }; export * from "./missing";` };

    expect(await definition("/app/api/typed.ts", "search", sources(others))).toBeUndefined();
  });
});
