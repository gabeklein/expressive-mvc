import { describe, expect, it, vi } from "vitest";

import { isAddress, locate, Manifest, type Exposed } from "./manifest";

const DIR = "/app/api";
const at = (file: string) => locate(DIR, file);

function exposed(file: string, fields: Partial<Exposed> = {}): Exposed {
  return { ...at(file)!, calls: [], errors: [], ...fields };
}

describe("locate", () => {
  it("will place a module in its folder's layer, an index as the folder itself", () => {
    expect(at("/app/api/todos.ts")).toEqual({ file: "/app/api/todos.ts", pattern: [], module: "todos", leaf: "todos" });
    expect(at("/app/api/admin/users.tsx")).toEqual({ file: "/app/api/admin/users.tsx", pattern: ["admin"], module: "users", leaf: "users" });
    expect(at("/app/api/admin/index.js")).toEqual({ file: "/app/api/admin/index.js", pattern: ["admin"], module: "" });
    for (const ext of ["ts", "tsx", "js", "jsx", "mts", "cts", "mjs", "cjs"])
      expect(at(`/app/api/admin/index.${ext}`)).toEqual({ file: `/app/api/admin/index.${ext}`, pattern: ["admin"], module: "" });
  });

  it("will not place a module outside the folder, or a file that is not a script", () => {
    expect(at("/app/src/main.ts")).toBeUndefined();
    expect(at("/app/apis/todos.ts")).toBeUndefined();
    expect(at("/app/api/data.json")).toBeUndefined();
  });

  it("will read [name] as a param, [...] as the rest of the path and (name) as the name itself", () => {
    expect(at("/app/api/jobs/[id]/events.ts")).toEqual({ file: "/app/api/jobs/[id]/events.ts", pattern: ["jobs", ":id"], module: "events", leaf: "events" });
    expect(at("/app/api/pdf/[id].ts")).toMatchObject({ pattern: ["pdf"], module: "[id]", leaf: ":id" });
    expect(at("/app/api/files/[...].ts")).toMatchObject({ pattern: ["files"], leaf: "*" });
    expect(at("/app/api/(files).ts")).toMatchObject({ pattern: [], module: "(files)", leaf: "files" });
    expect(at("/app/api/files/(index).ts")).toEqual({ file: "/app/api/files/(index).ts", pattern: ["files"], module: "(index)" });
  });

  it("will throw for a [...] folder, or a bracket that is not a param", () => {
    expect(() => at("/app/api/[...]/index.ts")).toThrow("api/[...]/index.ts: [...] takes the rest of the path - nothing is under it, so it is a file: [...].ts.");
    expect(() => at("/app/api/[...rest].ts")).toThrow("api/[...rest].ts: [...rest] is not a segment - a param is [name], and [...] takes the rest of the path.");
  });
});

it("will take only a bracketed module for an address", () => {
  expect(["(files).ts", "[id].ts", "[...].ts", "files/(index).ts"].map(file => isAddress(at(`/app/api/${file}`)!))).toEqual([true, true, true, true]);
  expect(["files.ts", "index.ts"].map(file => isAddress(at(`/app/api/${file}`)!))).toEqual([false, false]);
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

describe("tree", () => {
  const route = (file: string, methods = ["GET"]) => ({ ...at(file)!, methods });

  it("will nest each folder's calls, gate and routes as the URL meets them", () => {
    const manifest = new Manifest();

    manifest.modules.set("/app/api/todos.ts", exposed("/app/api/todos.ts", { calls: ["list"], errors: [{ name: "Over" }] }));
    manifest.modules.set("/app/api/index.ts", exposed("/app/api/index.ts", { calls: ["ping"] }));
    manifest.modules.set("/app/api/admin/users.ts", exposed("/app/api/admin/users.ts", { calls: ["list"] }));

    const entry = manifest.tree(
      [at("/app/api/index.ts")!, at("/app/api/admin/index.ts")!],
      [route("/app/api/jobs/[id]/(events).ts"), route("/app/api/files/[...].ts"), route("/app/api/admin/(index).ts", ["POST"])],
    );

    expect(entry).toContain(`import * as m0 from "/app/api/todos.ts";\nimport * as m1 from "/app/api/index.ts";\nimport * as m2 from "/app/api/admin/users.ts";\nimport * as m3 from "/app/api/admin/index.ts";\nimport * as m4 from "/app/api/jobs/[id]/(events).ts";\nimport * as m5 from "/app/api/files/[...].ts";\nimport * as m6 from "/app/api/admin/(index).ts";`);
    expect(entry).toContain(`const e0 = { calls: { "todos:list": m0.list, "ping": m1.ping }, classes: { "/#todos:Over": m0.Over } };\nverify("/", e0);`);
    expect(entry).toContain(`const e1 = { calls: { "users:list": m2.list }, classes: {  } };\nverify("/admin", e1);`);
    expect(entry).toContain(
      `export const handle = router({ calls: async () => e0, gate: async () => m1.default, children: { ` +
        `"admin": { calls: async () => e1, gate: async () => m3.default, index: async () => m6 }, ` +
        `"jobs": { children: { ":id": { children: { "events": { file: async () => m4 } } } } }, ` +
        `"files": { children: { "*": { file: async () => m5 } } } } });`,
    );
  });

  it("will serve the tree under a base", () => {
    expect(new Manifest().tree([], [], { base: "/api" })).toContain(`export const handle = router({  }, { base: "/api" });`);
  });

  it("will throw for a route beside a folder of its name, or two names for one param", () => {
    const manifest = new Manifest();
    const route = (file: string) => ({ ...at(file)!, methods: ["GET"] });

    manifest.modules.set("/app/api/files/list.ts", exposed("/app/api/files/list.ts", { calls: ["list"] }));

    expect(() => manifest.tree([], [route("/app/api/(files).ts")])).toThrow("/app/api/(files).ts answers /files, which its folder answers for too - move it into the folder, as files/(index).ts.");
    expect(() => new Manifest().tree([at("/app/api/[id]/index.ts")!], [route("/app/api/[id].ts")])).toThrow("move it into the folder, as [id]/(index).ts.");
    expect(() => new Manifest().tree([], [route("/app/api/a/(b).ts"), route("/app/api/a/b/(c).ts")])).toThrow("/app/api/a/(b).ts answers /a/b");
    expect(() => manifest.tree([], [route("/app/api/[id].ts"), route("/app/api/[slug]/(index).ts")])).toThrow("/:slug is taken by :id too - a folder's params need one name.");
  });
});
