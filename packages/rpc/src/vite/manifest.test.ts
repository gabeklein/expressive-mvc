import { describe, expect, it, vi } from "vitest";

import { locate, Manifest, type Exposed } from "./manifest";
import type { Leaf, Tree } from "./trunk";

const DIR = "/app/api";
const at = (file: string) => locate(DIR, file);

function exposed(file: string, fields: Partial<Exposed> = {}): Exposed {
  return { ...at(file)!, calls: [], errors: [], ...fields };
}

describe("locate", () => {
  it("will place a module in its folder's layer, an index as the folder itself", () => {
    expect(at("/app/api/todos.ts")).toEqual({ file: "/app/api/todos.ts", pattern: [], module: "todos" });
    expect(at("/app/api/admin/users.tsx")).toEqual({ file: "/app/api/admin/users.tsx", pattern: ["admin"], module: "users" });
    expect(at("/app/api/admin/index.js")).toEqual({ file: "/app/api/admin/index.js", pattern: ["admin"], module: "" });
  });

  it("will not place a module outside the folder, or a file that is not a script", () => {
    expect(at("/app/src/main.ts")).toBeUndefined();
    expect(at("/app/apis/todos.ts")).toBeUndefined();
    expect(at("/app/api/data.json")).toBeUndefined();
  });

  it("will throw for a module under a dynamic folder", () => {
    expect(() => at("/app/api/[id]/todos.ts")).toThrow("api/[id]/todos.ts is under [id] - folders are static path segments.");
  });
});

describe("ids", () => {
  const todos = at("/app/api/todos.ts")!;
  const root = at("/app/api/index.ts")!;
  const users = at("/app/api/admin/users.ts")!;

  it("will name calls readably, an index's by export alone, and classes by folder", () => {
    const manifest = new Manifest();

    expect(manifest.callId(todos, "list")).toBe("todos:list");
    expect(manifest.callId(root, "ping")).toBe("ping");
    expect(manifest.callId(users, "list")).toBe("users:list");
    expect(manifest.classId(todos, "Payment")).toBe("/#todos:Payment");
    expect(manifest.classId(users, "Banned")).toBe("/admin#users:Banned");
  });

  it("will hash every id with a salt", () => {
    const a = new Manifest("a");
    const b = new Manifest("b");

    expect(a.callId(todos, "list")).toMatch(/^[\w-]{16}$/);
    expect(a.classId(todos, "Payment")).toMatch(/^[\w-]{16}$/);
    expect(a.callId(todos, "list")).not.toBe(a.callId(users, "list"));
    expect(a.callId(todos, "list")).not.toBe(b.callId(todos, "list"));
  });
});

describe("stub", () => {
  it("will export each call through the shared client, and define each error under its parent", () => {
    const manifest = new Manifest();
    const stub = manifest.stub(exposed("/app/api/todos.ts", {
      calls: ["list"],
      errors: [
        { name: "Over" },
        { name: "Payment", parent: { id: "http:HttpError" } },
        { name: "Pro", parent: { file: "/app/api/todos.ts", name: "Payment" } },
      ],
    }), at);

    expect(stub).toBe([
      `import { call, define } from "@expressive/rpc";`,
      `const at = "/";`,
      `export const list = (...args) => call(at, "todos:list", args);`,
      `export const Over = define("/#todos:Over", "Over");`,
      `export const Payment = define("/#todos:Payment", "Payment", "http:HttpError");`,
      `export const Pro = define("/#todos:Pro", "Pro", "/#todos:Payment");`,
      "",
    ].join("\n"));
  });

  it("will import another module first when a parent is defined there", () => {
    const manifest = new Manifest();
    const stub = manifest.stub(exposed("/app/api/admin/users.ts", {
      errors: [
        { name: "Banned", parent: { file: "/app/api/admin/errors.ts", name: "Denied" } },
        { name: "Locked", parent: { file: "/app/api/admin/errors.ts", name: "Denied" } },
        { name: "Late", parent: { file: "/app/api/errors.ts", name: "Billing" } },
      ],
    }), at);

    expect(stub).toContain(`import "./errors.ts";\nimport "../errors.ts";\nconst at = "/admin";`);
    expect(stub).toContain(`define("/admin#users:Banned", "Banned", "/admin#errors:Denied")`);
    expect(stub).toContain(`define("/admin#users:Late", "Late", "/#errors:Billing")`);
  });
});

describe("stub for a host", () => {
  it("will import from the host's runtime, with its own path and lines after the errors", () => {
    const stub = new Manifest().stub(exposed("/app/api/todos.ts", { calls: ["list"], errors: [{ name: "Over" }] }), at, {
      from: "/runtime.ts",
      at: ["blog", ":slug"],
      imports: ["twin"],
      lines: ["export default twin(at);"],
    });

    expect(stub).toBe([
      `import { call, define, twin } from "/runtime.ts";`,
      `const at = ["blog",":slug"];`,
      `export const list = (...args) => call(at, "todos:list", args);`,
      `export const Over = define("/#todos:Over", "Over");`,
      "export default twin(at);",
      "",
    ].join("\n"));
  });
});

describe("exports", () => {
  it("will load each module of a folder under its ids, checking each module's classes", async () => {
    const manifest = new Manifest();
    const group = [
      exposed("/app/api/todos.ts", { calls: ["list"], errors: [{ name: "Over" }] }),
      exposed("/app/api/index.ts", { calls: ["ping"], errors: [{ name: "Down" }] }),
    ];
    const modules: Record<string, Record<string, unknown>> = {
      "/app/api/todos.ts": { list: "list()", Over: "Over" },
      "/app/api/index.ts": { ping: "ping()", Down: "Down" },
    };
    const check = vi.fn();

    expect(await manifest.exports(group, async file => modules[file], check)).toEqual({
      calls: { "todos:list": "list()", ping: "ping()" },
      classes: { "/#todos:Over": "Over", "/#Down": "Down" },
    });
    expect(check.mock.calls.map(([file, { classes }]) => [file, classes])).toEqual([
      ["/app/api/todos.ts", { "/#todos:Over": "Over" }],
      ["/app/api/index.ts", { "/#Down": "Down" }],
    ]);
  });
});

describe("calls", () => {
  it("will list each folder's calls and errors under their ids, with the gates along them", () => {
    const manifest = new Manifest();

    manifest.modules.set("/app/api/todos.ts", exposed("/app/api/todos.ts", { calls: ["list"], errors: [{ name: "Over" }] }));
    manifest.modules.set("/app/api/index.ts", exposed("/app/api/index.ts", { calls: ["ping"] }));
    manifest.modules.set("/app/api/admin/users.ts", exposed("/app/api/admin/users.ts", { calls: ["list"] }));

    const entry = manifest.calls([at("/app/api/index.ts")!, at("/app/api/admin/index.ts")!]);

    expect(entry).toContain(`import * as m0 from "/app/api/todos.ts";\nimport * as m1 from "/app/api/index.ts";\nimport * as m2 from "/app/api/admin/users.ts";\nimport * as m3 from "/app/api/admin/index.ts";`);
    expect(entry).toContain(`const e0 = { calls: { "todos:list": m0.list, "ping": m1.ping }, classes: { "/#todos:Over": m0.Over } };\nverify("/", e0);`);
    expect(entry).toContain(`const e1 = { calls: { "users:list": m2.list }, classes: {  } };\nverify("/admin", e1);`);
    expect(entry).toContain(`const gates = new Map([["", m1.default], ["admin", m3.default]]);`);
    expect(entry).toContain(`export const handle = handler([{ pattern: [], exports: async () => e0 }, { pattern: ["admin"], exports: async () => e1 }]`);
  });
});

describe("trunk", () => {
  it("will build the trunk's object from the stubs of the modules defining its leaves", () => {
    const search = { file: "/app/api/claim/search.ts", name: "search" };
    const tree = new Map<string, Tree | Leaf>([
      ["claim", new Map([["search", search], ["create", { file: "/app/api/claim/search.ts", name: "create" }]])],
      ["attorney", new Map([["search", { file: "/app/api/attorney/search.ts", name: "search" }]])],
      ["find-all", search],
      ["empty", new Map()],
    ]);

    expect(new Manifest().trunk("/app/api/trunk.ts", tree)).toBe([
      `import { search as t0, create as t1 } from "./claim/search.ts";`,
      `import { search as t2 } from "./attorney/search.ts";`,
      `export default { "claim": { "search": t0, "create": t1 }, "attorney": { "search": t2 }, "find-all": t0, "empty": {} };`,
      "",
    ].join("\n"));
  });
});
