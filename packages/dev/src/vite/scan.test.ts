import { describe, expect, it } from "vitest";
import type { Sources } from "@expressive/rpc/vite";

import { remoteOf } from "./routes";
import { scanRemote, scanTwin } from "./scan";

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

const MVC = `import { Model } from "@expressive/mvc";`;

describe("remote scan", () => {
  const at = (file: string) => remoteOf("/app", file);
  const scan = (source: string, file = "/app/tally/remote.ts", map: Record<string, string> = {}) => scanRemote(at(file)!, source, files(map), at);

  it("will leave calls and error classes to rpc's scanner", async () => {
    expect(await scan(`
      import { HttpError } from "@expressive/rpc";
      export class Over extends Error {}
      export class Payment extends HttpError {}
      export async function add() {}
    `)).toEqual({
      calls: ["add"],
      errors: [{ name: "Over" }, { name: "Payment", parent: { id: "http:HttpError" } }],
      pooled: [],
      seat: undefined,
      problems: [],
    });
  });

  it("will take a default subclass as the seat, however exported", async () => {
    expect((await scan(`${MVC} export default class Tally extends Model {}`)).seat?.name).toBe("Tally");
    expect((await scan(`${MVC} class A extends Model {} export { A as default }`)).seat?.name).toBe("A");
    expect((await scan(`${MVC} class B extends Model {} export default B`)).seat?.name).toBe("B");
    expect((await scan(`${MVC} export default class extends Model {}`)).seat?.name).toBe("default");
  });

  it("will refuse a default that is not a subclass", async () => {
    const problem = "A remote default is a Model subclass - its methods are what the client calls.";

    expect((await scan(`export default async () => {}`)).problems).toEqual([problem]);
    expect((await scan(`export default class {}`)).problems).toEqual([problem]);
  });

  it("will refuse a default outside the folder's remote entry", async () => {
    expect((await scan(`${MVC} export default class A extends Model {}`, "/app/tally/remote/bar.ts")).problems).toEqual([
      "Only a folder's remote entry - remote.ts or remote/index.ts - may export a default.",
    ]);
  });

  it("will take an exported Model class as a pooled twin", async () => {
    const { pooled, errors } = await scan(`${MVC} export class Cart extends Model { items = 0; async add() {} } export class Over extends Error {}`);

    expect(pooled).toEqual([{ name: "Cart", methods: ["add"], fields: ["items"] }]);
    expect(errors).toEqual([{ name: "Over" }]);
  });

  it("will not take a base imported as a type only", async () => {
    const map = {
      "/app/tally/errors.ts": `import { HttpError } from "@expressive/rpc"; export class Failed extends HttpError {}`,
      "/app/tally/base.ts": `${MVC} export class Base extends Model { async add() {} }`,
    };
    const found = await scan(`
      import type { Failed } from "./errors";
      import type { Base } from "./base";
      export class X extends Failed {}
      export class Cart extends Base {}
      export default class Tally extends Base {}
      export async function list() {}
    `, undefined, map);

    expect(found).toEqual({
      calls: ["list"],
      errors: [],
      pooled: [],
      seat: { name: "Tally", methods: [], fields: [] },
      problems: [
        "X extends Failed, which is neither declared nor imported.",
        "Cart extends Base, which is neither declared nor imported.",
        "Tally extends Base, which is neither declared nor imported in /app/tally/remote.ts.",
      ],
    });
  });

  it("will take an error's parent from a sidecar in its folder or above, and none from a sibling folder", async () => {
    const map = {
      "/app/remote.ts": `import { HttpError } from "@expressive/rpc"; export class Billing extends HttpError {}`,
      "/app/shop/remote.ts": `import { HttpError } from "@expressive/rpc"; export class Sold extends HttpError {}`,
    };
    const { errors } = await scan(`
      import { Billing } from "../remote";
      import { Sold } from "../shop/remote";
      export class Late extends Billing {}
      export class Gone extends Sold {}
    `, undefined, map);

    expect(errors).toEqual([
      { name: "Late", parent: { file: "/app/remote.ts", name: "Billing" } },
      { name: "Gone", parent: { id: "http:HttpError" } },
    ]);
  });
});

describe("twin scan", () => {
  const twin = (source: string, map: Record<string, string> = {}) => scanTwin(source, "/app/remote.ts", files(map));
  const HEAD = `import { Model } from "@expressive/mvc";`;

  it("will take a seat's public async methods and public values", async () => {
    expect(await twin(`${HEAD}
      export default class Tally extends Model {
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
    `)).toEqual({ twin: { name: "Tally", methods: ["add"], fields: ["total", "double"] }, state: true, problems: [] });
  });

  it("will refuse a public method that is not async", async () => {
    expect((await twin(`${HEAD} export default class Tally extends Model { add() {} }`)).problems).toEqual([
      "Tally.add() is not async - every call to it crosses the wire.",
    ]);
  });

  it("will take members a seat inherits from a class in its module", async () => {
    const { twin: found } = await twin(`${HEAD}
      class Base extends Model { count = 0; async increment() {} }
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
      "/app/base.ts": `${HEAD} export class Base extends Model { async reset() {} label = "" }`,
    });

    expect(found).toEqual({ name: "Tally", methods: ["add", "increment"], fields: ["count", "label"] });
    expect(problems).toEqual([]);
  });

  it("will read a compiled base through its declarations", async () => {
    const { twin: found } = await twin(`import { Base } from "./lib/base.js"; export default class Tally extends Base {}`, {
      "/app/lib/base.d.ts": `
        import { Model } from "@expressive/mvc";
        export declare class Base extends Model {
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

    expect(await problems(`${HEAD} const mix = (B: any) => B; export default class A extends mix(Model) {}`)).toEqual([
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

  it("will refuse a seat whose bases extend themselves", { timeout: 1000 }, async () => {
    const map: Record<string, string> = {
      "/app/a.ts": `import { B } from "./b"; export class A extends B { async a() {} }`,
      "/app/b.ts": `import { A } from "./a"; export class B extends A { async b() {} }`,
    };
    const sources: Sources = {
      resolve: spec => new Promise(done => setTimeout(done, 0, `/app/${spec.slice(2)}.ts`)),
      read: file => map[file],
    };

    expect(await scanTwin(`import { A } from "./a"; export default class Tally extends A {}`, "/app/remote.ts", sources)).toEqual({
      twin: { name: "Tally", methods: ["a", "b"], fields: [] },
      state: false,
      problems: ["A extends B, which extends A - a class cannot extend itself."],
    });
    expect(await twin(`${HEAD} const Base = class extends Model { async a() {} }; const Mid = class extends Base {}; export default class Tally extends Mid {}`)).toEqual({
      twin: { name: "Tally", methods: ["a"], fields: [] },
      state: true,
      problems: [],
    });
  });

  it("will name an anonymous default in a loop of bases", async () => {
    const { problems } = await twin(`import A from "./a"; export default class Tally extends A {}`, {
      "/app/a.ts": `import B from "./b"; export default class extends B {}`,
      "/app/b.ts": `import A from "./a"; export default class B extends A {}`,
    });

    expect(problems).toEqual(["default extends B, which extends default - a class cannot extend itself."]);
  });

  it("will report a sync method a seat inherits", async () => {
    const { problems } = await twin(`import { Base } from "./base"; export default class A extends Base {}`, {
      "/app/base.ts": `${HEAD} export class Base extends Model { tick() {} }`,
    });

    expect(problems).toEqual(["Base.tick() is not async - every call to it crosses the wire."]);
  });

  it("will find nothing without a default class", async () => {
    expect(await twin(`export async function add() {}`)).toEqual({ state: false, problems: [] });
  });

  it("will scan an owned child by its initializer or declared type, with its own members and children", async () => {
    const { twin: scanned, problems } = await twin(`${HEAD}
      import { Line } from "./line";
      class Cart extends Model {
        items = 0;
        last = new Line();
        async add() {}
        protected secret = 1;
      }
      export default class Shop extends Model {
        cart = new Cart();
        spare?: Cart = undefined;
        made = Cart.new();
        stamp: Date = new Date();
        label = "shop";
      }
    `, { "/app/line.ts": `${HEAD} export class Line extends Model { qty = 1; async bump() {} }` });

    const cart = { name: "Cart", methods: ["add"], fields: ["items", "last"], children: { last: { name: "Line", methods: ["bump"], fields: ["qty"] } } };

    expect(problems).toEqual([]);
    expect(scanned).toEqual({
      name: "Shop",
      methods: [],
      fields: ["cart", "spare", "made", "stamp", "label"],
      children: { cart, spare: cart, made: cart },
    });
  });

  it("will scan an owned child whose class is imported as a type only", async () => {
    const { twin: scanned } = await twin(`${HEAD} import type { Line } from "./line"; export default class Shop extends Model { line?: Line; }`, {
      "/app/line.ts": `${HEAD} export class Line extends Model { qty = 1; }`,
    });

    expect(scanned).toEqual({ name: "Shop", methods: [], fields: ["line"], children: { line: { name: "Line", methods: [], fields: ["qty"] } } });
  });

  it("will leave a field plain when its class is not a Model", async () => {
    const { twin: scanned } = await twin(`${HEAD}
      class Point { x = 0; }
      export default class Shop extends Model { at = new Point(); when?: Date; other?: Cart | Point; }
    `);

    expect(scanned).toEqual({ name: "Shop", methods: [], fields: ["at", "when", "other"] });
  });

  it("will leave a field plain when its declared class cannot be followed", async () => {
    const { twin: scanned } = await twin(`${HEAD}
      import type { Gone } from "./nowhere";
      import type { Flag } from "./flag";
      import type * as Lib from "./lib";
      export default class Shop extends Model { gone?: Gone; flag?: Flag; ns?: Lib.Cart; made = Shop.create(); }
    `, { "/app/flag.ts": "export const Flag = 1;" });

    expect(scanned).toEqual({ name: "Shop", methods: [], fields: ["gone", "flag", "ns", "made"] });
  });

  it("will scan an owned child declared with null or undefined", async () => {
    const { twin: scanned } = await twin(`${HEAD}
      class Line extends Model { qty = 1; }
      export default class Shop extends Model { line?: Line | null | undefined; }
    `);

    expect(scanned).toEqual({ name: "Shop", methods: [], fields: ["line"], children: { line: { name: "Line", methods: [], fields: ["qty"] } } });
  });

  it("will skip a constructor, setters and static blocks", async () => {
    const { twin: scanned, problems } = await twin(`${HEAD}
      export default class Shop extends Model {
        static { }
        constructor() { super(); }
        set label(value: string) {}
        async buy() {}
      }
    `);

    expect(problems).toEqual([]);
    expect(scanned).toEqual({ name: "Shop", methods: ["buy"], fields: [] });
  });

  it("will refuse a public reference and a child that holds itself", async () => {
    const { problems } = await twin(`
      import { Model, get } from "@expressive/mvc";
      class Node extends Model { next?: Node; }
      class Session extends Model {}
      export default class Shop extends Model {
        session = get(Session);
        protected kept = get(Session);
        node = new Node();
      }
    `);

    expect(problems).toEqual([
      "Shop.session is a public reference - get() fields do not cross yet; declare it protected or private.",
      "Node.next holds a Node, which holds itself - a twin's children cannot recurse.",
    ]);
  });

  it("will refuse a child that holds itself across modules", async () => {
    const { problems } = await twin(`
      import { Model } from "@expressive/mvc";
      import { A } from "./a";
      export default class Shop extends Model { a = new A(); }
    `, {
      "/app/a.ts": `import { Model } from "@expressive/mvc"; import { B } from "./b"; export class A extends Model { b?: B; }`,
      "/app/b.ts": `import { Model } from "@expressive/mvc"; import { A } from "./a"; export class B extends Model { a?: A; }`,
    });

    expect(problems).toEqual(["B.a holds a A, which holds itself - a twin's children cannot recurse."]);
  });

  it("will scan a named class as a Model class when its bases reach an Expressive one", async () => {
    const source = `${HEAD}
      export class Cart extends Model { items = 0; async add() {} }
      export class Over extends Error { status = 409; toJSON() {} }
    `;
    const named = (name: string) => scanTwin(source, "/app/remote.ts", files({}), name);

    expect(await named("Cart")).toEqual({ twin: { name: "Cart", methods: ["add"], fields: ["items"] }, state: true, problems: [] });
    expect(await named("Over")).toMatchObject({ state: false, problems: [] });
  });

  it("will scan a class extending rpc's http errors as an error class, never a Model", async () => {
    const source = `
      import { HttpError, NotFound } from "@expressive/rpc";
      export class Payment extends HttpError { status = 402; }
      export class Missing extends NotFound {}
    `;
    const named = (name: string) => scanTwin(source, "/app/remote.ts", files({}), name);

    expect(await named("Payment")).toEqual({ state: false, problems: [] });
    expect(await named("Missing")).toEqual({ state: false, problems: [] });
  });

  it("will refuse a folder's default that extends an http error", async () => {
    const { problems } = await twin(`
      import { Forbidden } from "@expressive/rpc";
      export default class Gate extends Forbidden {}
    `);

    expect(problems).toEqual(["Gate extends Forbidden, an error class - a folder's default must be a Model."]);
  });

  it("will take a folder's default extending a root class that is not an http error, as Current", async () => {
    const { problems, state } = await scanTwin(`
      import { Current } from "@expressive/rpc";
      export default class Gate extends Current {}
    `, "/app/remote.ts", files({}));

    expect({ problems, state }).toEqual({ problems: [], state: true });
  });
});
