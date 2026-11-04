import { describe, expect, it } from "vitest";

import { scanModule, type Sources } from "./scan";

const HTTP = `import { Current, HttpError, NotFound } from "@expressive/rpc/http";`;
const MVC = `import { Model } from "@expressive/mvc";`;

function scan(source: string, file = "/app/api/todos.ts", others: Record<string, string> = {}) {
  const sources: Sources = {
    resolve: async (spec, importer) => {
      const file = new URL(spec, `file://${importer}`).pathname + ".ts";
      return file in others ? file : undefined;
    },
    read: file => others[file],
  };

  return scanModule(file, source, sources, file => file.startsWith("/app/api/"));
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
    `);

    expect(found).toEqual({ calls: ["list", "add", "complete", "all"], errors: [], gate: false, problems: [] });
  });

  it("will refuse a sync function, a value, and anything but functions and classes", async () => {
    const { problems } = await scan(`
      export function list() {}
      export const count = 1;
      export const { a } = { a: 1 };
      export enum Kind { A }
    `);

    expect(problems).toEqual([
      "A server module exports async functions and Error classes only.",
      "list() is not async - every call to it crosses the wire.",
      "count is neither an async function nor an Error class - the client could not use it.",
      "A destructured export is neither an async function nor an Error class - the client could not use it.",
    ]);
  });

  it("will refuse a re-export", async () => {
    const { problems } = await scan(`export { list } from "./other"; export * from "./more";`);

    expect(problems).toEqual(["A server module cannot re-export from another module.", "A server module cannot re-export from another module."]);
  });

  it("will report a syntax error", async () => {
    expect((await scan("export async function (")).problems).not.toEqual([]);
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
      export class Wrong extends TypeError {}
    `);

    expect(problems).toEqual([]);
    expect(errors).toEqual([{ name: "Over" }, { name: "Wrong" }]);
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

  it("will refuse a class that is not an Error", async () => {
    const { problems } = await scan(`${HTTP} ${MVC}
      export class Cart extends Model {}
      export class Plain {}
      export class Store extends Map {}
      export class Request extends Current {}
    `);

    expect(problems).toEqual(["Cart", "Plain", "Store", "Request"].map(name =>
      `${name} is a class but not an Error - only error classes reach the client; a Model it constructs is a twin, which needs @expressive/dev.`));
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
      "E extends itself.",
    ]);
  });
});

describe("gates", () => {
  it("will take an index's default Model as its folder's gate", async () => {
    expect(await scan(`${MVC} export default class Gate extends Model {} export async function ping() {}`, "/app/api/index.ts"))
      .toEqual({ calls: ["ping"], errors: [], gate: true, problems: [] });
  });

  it("will follow a gate's default through a local name and an imported base", async () => {
    const others = { "/app/lib/session.ts": `${MVC} export class Session extends Model {}` };
    const found = await scan(`import { Session } from "../../lib/session"; class Gate extends Session {} export default Gate;`, "/app/api/admin/index.ts", others);

    expect(found.gate).toBe(true);
  });

  it("will refuse a default outside an index", async () => {
    expect((await scan(`${MVC} export default class Gate extends Model {}`)).problems).toEqual(["Only a folder's index may export a default - its gate."]);
  });

  it("will refuse an index's default that is not a Model", async () => {
    const problem = "An index's default is its folder's gate - a Model subclass whose static key() admits each call.";

    expect((await scan(`export default async function () {}`, "/app/api/index.ts")).problems).toEqual([problem]);
    expect((await scan(`export default class Oops extends Error {}`, "/app/api/index.ts")).problems).toEqual([problem]);
    expect((await scan(`export default class extends Undeclared {}`, "/app/api/index.ts")).problems).toEqual(["default extends Undeclared, which is neither declared nor imported."]);
  });
});
