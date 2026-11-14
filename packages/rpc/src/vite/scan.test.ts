import { describe, expect, it } from "vitest";

import { DECLARED, isClass, scanModule, type Extension, type Sources } from "./scan";

const HTTP = `import { Current, HttpError, NotFound } from "@expressive/rpc";`;
const MVC = `import { Model } from "@expressive/mvc";`;

function scan(source: string, file = "/app/api/todos.ts", others: Record<string, string> = {}, extension?: Extension) {
  const sources: Sources = {
    resolve: async (spec, importer) => {
      const file = new URL(spec, `file://${importer}`).pathname + ".ts";
      return file in others ? file : undefined;
    },
    read: file => others[file],
  };

  return scanModule(file, source, sources, file => file.startsWith("/app/api/"), extension);
}

describe("calls", () => {
  it("will take each exported async function as a call", async () => {
    const found = await scan(`
      export async function list() {}
      export const add = async (title: string) => title;
      const done = async function () {};
      export { done as complete };
      export type Todo = { id: string };
      export interface Item {}
      type Hidden = 1;
      export type { Hidden };
      export { list as "all" };
      export const b = async () => 1, c = async function () {};
      async function e() {}
      export { e as f };
    `);

    expect(found).toEqual({ calls: ["list", "add", "complete", "all", "b", "c", "f"], errors: [], gate: false, problems: [] });
  });

  it("will refuse a sync function, a value, and anything but functions and classes", async () => {
    const { problems } = await scan(`
      export function list() {}
      export const count = 1;
      export const { a } = { a: 1 };
      export enum Kind { A }
    `);

    expect(problems).toEqual([
      "A server module exports async functions and Error subclasses only.",
      "list() is not async - every call to it crosses the wire.",
      "count is neither an async function nor an Error subclass - the client could not use it.",
      "A destructured export is neither an async function nor an Error subclass - the client could not use it.",
    ]);
  });

  it("will refuse an export name the stub could not declare", async () => {
    expect((await scan(`async function list() {} export { list as "list-all" };`)).problems).toEqual([`"list-all" is not an identifier - the client stub could not export it.`]);
  });

  it("will refuse a re-export", async () => {
    const { problems } = await scan(`export { list } from "./other"; export * from "./more";`);

    expect(problems).toEqual(["A server module cannot re-export from another module.", "A server module cannot re-export from another module."]);
  });

  it("will report a syntax error", async () => {
    expect((await scan("export async function (")).problems[0]).toBe("Expected function name");
  });
});

describe("error classes", () => {
  it("will take a subclass of an http error with that error as its parent", async () => {
    const { errors, problems } = await scan(`${HTTP}
      export class Payment extends HttpError { status = 402 }
      export class Missing extends NotFound {}
    `);

    expect(problems).toEqual([]);
    expect(errors).toEqual([
      { name: "Payment", parent: { id: "http:HttpError" } },
      { name: "Missing", parent: { id: "http:NotFound" } },
    ]);
  });

  it("will take the nearest exported class as the parent, past an unexported one", async () => {
    const { errors } = await scan(`${HTTP}
      class Base extends HttpError {}
      export class Billing extends Base {}
      export class Payment extends Billing {}
      export class Refund extends Base {}
    `);

    expect(errors).toEqual([
      { name: "Billing", parent: { id: "http:HttpError" } },
      { name: "Payment", parent: { file: "/app/api/todos.ts", name: "Billing" } },
      { name: "Refund", parent: { id: "http:HttpError" } },
    ]);
  });

  it("will list errors in source order, so each parent is defined first", async () => {
    const { errors } = await scan(`${HTTP}
      class Base extends HttpError {}
      class Payment extends Base {}
      export { Payment, Base as Billing };
    `);

    expect(errors.map(error => error.name)).toEqual(["Billing", "Payment"]);
  });

  it("will take a subclass of a global error without a parent", async () => {
    const { errors, problems } = await scan(`
      export class Over extends Error {}
      export const Wrong = class extends TypeError {};
      class Range extends RangeError {}
      export { Range };
    `);

    expect(problems).toEqual([]);
    expect(errors).toEqual([{ name: "Over" }, { name: "Wrong" }, { name: "Range" }]);
  });

  it("will follow a base imported from another module, taking it as the parent if the folder exports it", async () => {
    const others = {
      "/app/api/errors.ts": `${HTTP} export class Billing extends HttpError {}`,
      "/app/lib/errors.ts": `${HTTP} export class Shared extends NotFound {}`,
    };
    const { errors, problems } = await scan(`
      import { Billing } from "./errors";
      import { Shared } from "../lib/errors";
      export class Payment extends Billing {}
      export class Gone extends Shared {}
    `, undefined, others);

    expect(problems).toEqual([]);
    expect(errors).toEqual([
      { name: "Payment", parent: { file: "/app/api/errors.ts", name: "Billing" } },
      { name: "Gone", parent: { id: "http:NotFound" } },
    ]);
  });

  it("will take a base from a package as an error, verified when the server loads it", async () => {
    const { errors } = await scan(`import type { Issue } from "zod"; import * as z from "zod"; import zod, { ZodError } from "zod"; export class Invalid extends ZodError {}`);

    expect(errors).toEqual([{ name: "Invalid" }]);
  });

  it("will not take a base imported as a type only", async () => {
    const others = { "/app/api/base.ts": `${HTTP} export class Base extends HttpError {} export default class Root extends HttpError {}` };
    const { errors, problems } = await scan(`
      import type { Base } from "./base";
      import { type Base as Other } from "./base";
      import type Root from "./base";
      export class X extends Base {}
      export class Y extends Other {}
      export class Z extends Root {}
      export async function list() {}
    `, undefined, others);

    expect(errors).toEqual([]);
    expect(problems).toEqual([
      "X extends Base, which is neither declared nor imported.",
      "Y extends Other, which is neither declared nor imported.",
      "Z extends Root, which is neither declared nor imported.",
    ]);
  });

  it("will refuse a class that extends itself across modules", { timeout: 1000 }, async () => {
    const others: Record<string, string> = {
      "/app/api/a.ts": `import { B } from "./b"; export class A extends B {}`,
      "/app/api/b.ts": `import { A } from "./a"; export class B extends A {}`,
    };
    const sources: Sources = {
      resolve: spec => new Promise(done => setTimeout(done, 0, `/app/api/${spec.slice(2)}.ts`)),
      read: file => others[file],
    };
    const { errors, problems } = await scanModule("/app/api/todos.ts", `import { A } from "./a"; export class X extends A {} export class Y extends Y {} export const Z = class extends Z {};`, sources, () => true);

    expect(errors).toEqual([]);
    expect(problems).toEqual([
      "A extends B, which extends A - a class cannot extend itself.",
      "Y extends Y - a class cannot extend itself.",
      "Z extends Z - a class cannot extend itself.",
    ]);
  });

  it("will refuse a class that is not an Error", async () => {
    const { problems } = await scan(`${HTTP} ${MVC}
      export class Cart extends Model {}
      export class Plain {}
      export class Store extends Map {}
      export class Request extends Current {}
    `);

    expect(problems).toEqual([
      "Cart is a class but not an Error - only error classes reach the client; a Model it constructs is a twin, which needs @expressive/dev.",
      ...["Plain", "Store"].map(name => `${name} is a class but not an Error - only error classes reach the client.`),
      "Request is a class but not an Error - only error classes reach the client; a Model it constructs is a twin, which needs @expressive/dev.",
    ]);
  });

  it("will refuse a base it cannot follow", async () => {
    const others = { "/app/api/values.ts": "export const Value = 1;" };
    const { problems } = await scan(`
      import { Missing } from "./missing";
      import { Value } from "./values";
      const mixin = (B: any) => B;
      export class A extends Missing {}
      export class B extends Value {}
      export class C extends mixin(Error) {}
      export class D extends Undeclared {}
      class E extends F {}
      class F extends E {}
      export { E };
    `, undefined, others);

    expect(problems).toEqual([
      `A extends Missing from "./missing", which does not resolve.`,
      `B extends Value, which "./values" does not export as a class.`,
      "C extends an expression - name its base class.",
      "D extends Undeclared, which is neither declared nor imported.",
      "E extends F, which extends E - a class cannot extend itself.",
    ]);
  });
});

describe("gates", () => {
  it("will take an index's default Model as its folder's gate", async () => {
    expect(await scan(`${MVC} export default class Gate extends Model {} export async function ping() {}`, "/app/api/index.ts"))
      .toEqual({ calls: ["ping"], errors: [], gate: true, problems: [] });
  });

  it("will take a gate extending a root class that is not an http error, as Current", async () => {
    expect(await scan(`import { Current } from "@expressive/rpc"; export default class Gate extends Current {}`, "/app/api/index.ts"))
      .toEqual({ calls: [], errors: [], gate: true, problems: [] });
  });

  it("will follow a gate's default through a local name and an imported base", async () => {
    const others = { "/app/lib/session.ts": `${MVC} export class Session extends Model {}` };
    const found = await scan(`import { Session } from "../../lib/session"; class Gate extends Session {} export default Gate;`, "/app/api/admin/index.ts", others);

    expect(found.gate).toBe(true);
  });

  it("will refuse a default outside an index", async () => {
    expect((await scan(`${MVC} export default class Gate extends Model {}`)).problems).toEqual(["Only a folder's index may export a default - its gate."]);
  });

  it("will take an index's default function as its gate", async () => {
    expect(await scan(`export default async function () {} export async function ping() {}`, "/app/api/index.ts")).toEqual({ calls: ["ping"], errors: [], gate: true, problems: [] });
    expect((await scan(`const gate = () => {}; export default gate;`, "/app/api/index.ts")).gate).toBe(true);
  });

  it("will refuse an index's default that is neither a function nor a Model", async () => {
    const problem = "An index's default is its folder's gate - a function run before each call, or a Model subclass whose static key() admits each call.";

    expect((await scan(`export default 1;`, "/app/api/index.ts")).problems).toEqual([problem]);
    expect((await scan(`export default class Oops extends Error {}`, "/app/api/index.ts")).problems).toEqual([problem]);
    expect((await scan(`export default class extends Undeclared {}`, "/app/api/index.ts")).problems).toEqual(["default extends Undeclared, which is neither declared nor imported."]);
  });

  it("will refuse an imported default, which it cannot check", async () => {
    expect((await scan(`import { guard } from "../lib/guard"; export default guard;`, "/app/api/index.ts")).problems).toEqual([DECLARED]);
  });
});

describe("extension", () => {
  it("will let the extension claim an exported class, leaving the rest to the error rules", async () => {
    const offered: string[] = [];
    const claim = async (name: string) => (offered.push(name), name === "Cart" ? [] : name === "Odd" ? ["Odd is odd"] : undefined);
    const found = await scan(`${HTTP} ${MVC}
      export class Cart extends Model {}
      export class Odd extends Model {}
      export class Over extends HttpError {}
      export class Plain {}
      export async function add() {}
    `, undefined, undefined, { claim });

    expect(offered).toEqual(["Cart", "Odd", "Over", "Plain"]);
    expect(found).toEqual({
      calls: ["add"],
      errors: [{ name: "Over", parent: { id: "http:HttpError" } }],
      gate: false,
      problems: ["Odd is odd", "Plain is a class but not an Error - only error classes reach the client."],
    });
  });

  it("will hand the default to the extension in place of the gate rules, in any module", async () => {
    const seen: boolean[] = [];
    const extension: Extension = { default: async value => (seen.push(isClass(value)), isClass(value) ? [] : ["not a class"]) };

    expect(await scan(`${MVC} export default class Seat extends Model {}`, undefined, undefined, extension)).toEqual({ calls: [], errors: [], gate: false, problems: [] });
    expect((await scan(`export default 1`, "/app/api/index.ts", undefined, extension)).problems).toEqual(["not a class"]);
    expect(seen).toEqual([true, false]);
  });
});

describe("only", () => {
  const only = (source: string, names: string[], file?: string, others?: Record<string, string>) => {
    const sources: Sources = { resolve: async spec => (spec.endsWith("base") ? "/app/api/base.ts" : undefined), read: () => `export class Base extends Error {}` };
    return scanModule(file ?? "/app/api/todos.ts", source, sources, file => file.startsWith("/app/api/"), {}, new Set(names));
  };

  it("will take only the names given as calls, leaving the rest unchecked on the server", async () => {
    const found = await only(`${MVC}
      import { helper } from "./helper";
      export async function list() {}
      export async function internal() {}
      export function sync() {}
      export const count = 1;
      export enum Kind { A }
      export { helper };
      export * from "./more";
      export { other } from "./other";
      export class Store extends Model {}
      export default async function () {}
    `, ["list"]);

    expect(found).toEqual({ calls: ["list"], errors: [], gate: false, problems: [] });
  });

  it("will still take every Error class, leaf or not, under its parent", async () => {
    const found = await only(`${HTTP}
      import { Base } from "./base";
      export class Over extends HttpError {}
      export class Late extends Base {}
      export class Odd extends Undeclared {}
    `, ["Over"]);

    expect(found).toEqual({ calls: [], errors: [{ name: "Over", parent: { id: "http:HttpError" } }, { name: "Late", parent: { file: "/app/api/base.ts", name: "Base" } }], gate: false, problems: [] });
  });

  it("will still refuse a leaf the client could not call", async () => {
    const { problems } = await only(`export function sync() {} export const count = 1; export async function fine() {}`, ["sync", "count"]);

    expect(problems).toEqual(["sync() is not async - every call to it crosses the wire.", "count is neither an async function nor an Error subclass - the client could not use it."]);
  });

  it("will take an index's default as its gate only when named", async () => {
    expect(await only(`${MVC} export default class Gate extends Model {} export { a } from "./a";`, ["default"], "/app/api/index.ts")).toEqual({ calls: [], errors: [], gate: true, problems: [] });
    expect(await only(`export default () => {}; export { a } from "./a";`, ["default"], "/app/api/index.ts")).toEqual({ calls: [], errors: [], gate: true, problems: [] });
    expect((await only(`export default 1;`, ["default"], "/app/api/index.ts")).problems).toEqual(["An index's default is its folder's gate - a function run before each call, or a Model subclass whose static key() admits each call."]);
    expect(await only(`export default function Page() {}`, [], "/app/api/index.ts")).toEqual({ calls: [], errors: [], gate: false, problems: [] });
  });
});
