import { describe, expect, it } from "vitest";

import { scanSidecar, scanTwin, type Sources } from "./scan";

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

  it("will take a default subclass as the seat, however exported", () => {
    expect(scan(`export default class Tally extends State {}`).seat).toBe("Tally");
    expect(scan(`class A extends State {} export { A as default }`).seat).toBe("A");
    expect(scan(`class B extends State {} export default B`).seat).toBe("B");
    expect(scan(`export default class extends State {}`).seat).toBe("default");
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

describe("twin scan", () => {
  const files = (map: Record<string, string>): Sources => ({
    resolve: async (spec, importer) => {
      const file = new URL(spec.endsWith(".js") ? spec : `${spec}.ts`, `file://${importer}`).pathname;
      return file in map || file.replace(/\.js$/, ".d.ts") in map ? file : undefined;
    },
    read: file => {
      if (!(file in map)) throw new Error(`No ${file}`);
      return map[file];
    },
  });

  const twin = (source: string, map: Record<string, string> = {}) => scanTwin(source, "/app/remote.ts", files(map));
  const HEAD = `import { State } from "@expressive/mvc";`;

  it("will take a seat's public async methods and public values", async () => {
    expect(await twin(`${HEAD}
      export default class Tally extends State {
        static ttl = 60;
        static async reset() {}
        total = 0;
        get double() { return this.total * 2 }
        private secret = 1;
        protected guard = 2;
        #hidden = 3;
        _internal = 4;
        async add(by: number) {}
        private async quiet() {}
        protected async guarded() {}
        async #private() {}
        async _helper() {}
        async use() {}
      }
    `)).toEqual({ twin: { name: "Tally", methods: ["add"], fields: ["total", "double"] }, problems: [] });
  });

  it("will refuse a public method that is not async", async () => {
    expect((await twin(`${HEAD} export default class Tally extends State { add() {} }`)).problems).toEqual([
      "Tally.add() is not async - every call to it crosses the wire.",
    ]);
  });

  it("will take members a seat inherits from a class in its module", async () => {
    const { twin: found } = await twin(`${HEAD}
      class Base extends State { count = 0; async increment() {} }
      export default class Tally extends Base { async add() {} }
    `);

    expect(found).toEqual({ name: "Tally", methods: ["add", "increment"], fields: ["count"] });
  });

  it("will take members a seat inherits through imports, the nearest declaration winning", async () => {
    const { twin: found, problems } = await twin(`
      import { Counter } from "./counter";
      export default class Tally extends Counter { protected async reset() {} async add() {} }
    `, {
      "/app/counter.ts": `import { Base } from "./base"; export class Counter extends Base { count = 0; async increment() {} }`,
      "/app/base.ts": `${HEAD} export class Base extends State { async reset() {} label = "" }`,
    });

    expect(found).toEqual({ name: "Tally", methods: ["add", "increment"], fields: ["count", "label"] });
    expect(problems).toEqual([]);
  });

  it("will read a compiled base through its declarations", async () => {
    const { twin: found } = await twin(`import { Base } from "./lib/base.js"; export default class Tally extends Base {}`, {
      "/app/lib/base.d.ts": `
        import { State } from "@expressive/mvc";
        export declare class Base extends State {
          count: number;
          increment(): Promise<number>;
          private secret;
        }
      `,
    });

    expect(found).toEqual({ name: "Tally", methods: ["increment"], fields: ["count"] });
  });

  it("will report a base it cannot follow", async () => {
    const problems = async (source: string, map: Record<string, string> = {}) => (await twin(source, map)).problems;

    expect(await problems(`${HEAD} const mix = (B: any) => B; export default class A extends mix(State) {}`)).toEqual([
      "A extends an expression - a twin's bases must be classes reached by name.",
    ]);
    expect(await problems(`export default class A extends Missing {}`)).toEqual([
      "A extends Missing, which is neither declared nor imported in /app/remote.ts.",
    ]);
    expect(await problems(`import { B } from "./nowhere"; export default class A extends B {}`)).toEqual([
      'A extends B from "./nowhere", which does not resolve.',
    ]);
    expect(await problems(`import { B } from "./b"; export default class A extends B {}`, { "/app/b.ts": "export const B = 1;" })).toEqual([
      "A extends B, which /app/b.ts does not export as a class.",
    ]);
  });

  it("will report a sync method a seat inherits", async () => {
    const { problems } = await twin(`import { Base } from "./base"; export default class A extends Base {}`, {
      "/app/base.ts": `${HEAD} export class Base extends State { tick() {} }`,
    });

    expect(problems).toEqual(["Base.tick() is not async - every call to it crosses the wire."]);
  });

  it("will find nothing without a default class", async () => {
    expect(await twin(`export async function add() {}`)).toEqual({ problems: [] });
  });
});
