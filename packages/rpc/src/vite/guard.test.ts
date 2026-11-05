import { describe, expect, it } from "vitest";

import * as client from "../client";
import * as server from "../server";
import { guard, guardScript, SERVER_ONLY } from "./guard";

describe("server-only names", () => {
  it("will list exactly what the server build exports and the browser build does not", () => {
    expect([...SERVER_ONLY].sort()).toEqual(Object.keys(server).filter(name => !(name in client)).sort());
  });
});

describe("guard", () => {
  it("will refuse a server-only name imported or re-exported from the root", () => {
    expect(guard(`import { Current } from "@expressive/rpc";`)).toBe("imports Current from @expressive/rpc, which only its server build exports.");
    expect(guard(`import { NotFound,\n  Current as C, } from '@expressive/rpc'`)).toMatch(/^imports Current from /);
    expect(guard(`export { Current } from "@expressive/rpc";`)).toMatch(/^imports Current /);
    expect(guard(`import def, { Current } from "@expressive/rpc";`)).toMatch(/^imports Current /);
  });

  it("will refuse any value import of the host adapter", () => {
    const refused = "imports @expressive/rpc/http, the host adapter - only a server entry uses it.";

    expect(guard(`import { handler } from "@expressive/rpc/http";`)).toBe(refused);
    expect(guard(`import { type HandlerOptions, toNode } from "@expressive/rpc/http";`)).toBe(refused);
    expect(guard(`import * as http from "@expressive/rpc/http";`)).toBe(refused);
    expect(guard(`import "@expressive/rpc/http";`)).toBe(refused);
    expect(guard(`export * from "@expressive/rpc/http";`)).toBe(refused);
    expect(guard(`export const load = () => import("@expressive/rpc/http");`)).toBe(refused);
    expect(guard(`import { Current } from "@expressive/rpc";\nexport { reply } from "@expressive/rpc/http";`)).toBe(`imports Current from @expressive/rpc, which only its server build exports. ${refused}`);
  });

  it("will refuse any value import of the server plumbing", () => {
    const refused = "imports @expressive/rpc/protocol, server plumbing - only a server or host module uses it.";

    expect(guard(`import { within } from "@expressive/rpc/protocol";`)).toBe(refused);
    expect(guard(`import protocol from "@expressive/rpc/protocol";`)).toBe(refused);
    expect(guard(`import * as protocol from "@expressive/rpc/protocol";`)).toBe(refused);
    expect(guard(`import "@expressive/rpc/protocol";`)).toBe(refused);
    expect(guard(`export * from "@expressive/rpc/protocol";`)).toBe(refused);
    expect(guard(`export const load = () => import("@expressive/rpc/protocol");`)).toBe(refused);
    expect(guard(`import { handler } from "@expressive/rpc/http";\nimport { verify } from "@expressive/rpc/protocol";`)).toBe(
      `imports @expressive/rpc/http, the host adapter - only a server entry uses it. ${refused}`,
    );
  });

  it("will allow what the browser build exports, types, and other modules", () => {
    expect(guard(`import { call, configure, NotFound, Redirect } from "@expressive/rpc";`)).toBeUndefined();
    expect(guard(`import type { Current } from "@expressive/rpc";`)).toBeUndefined();
    expect(guard(`import { type Current, call } from "@expressive/rpc";`)).toBeUndefined();
    expect(guard(`import * as rpc from "@expressive/rpc";`)).toBeUndefined();
    expect(guard(`export const load = () => import("@expressive/rpc");\nexport const url = import.meta.url;`)).toBeUndefined();
    expect(guard(`import type { HandlerOptions } from "@expressive/rpc/http";`)).toBeUndefined();
    expect(guard(`import { type HandlerOptions } from "@expressive/rpc/http";`)).toBeUndefined();
    expect(guard(`import type { Seat } from "@expressive/rpc/protocol";\nimport { type Seats } from "@expressive/rpc/protocol";`)).toBeUndefined();
    expect(guard(`import { Current } from "@expressive/rpc/protocol/other";\nimport { Current as C } from "@expressive/rpc/http/other";`)).toBeUndefined();
  });

  it("will pass a module that never names the package", () => {
    expect(guard(`import { Current } from "./current";\nexport const a = Current;`)).toBeUndefined();
  });

  it("will ignore an import written only in a comment or a string", () => {
    expect(guard(`// import { Current } from "@expressive/rpc";\nexport const a = 1;`)).toBeUndefined();
    expect(guard(`/** e.g. import { toNode } from "@expressive/rpc/http" */\nexport const b = 2;`)).toBeUndefined();
    expect(guard("export const doc = `import { Current } from \"@expressive/rpc\"`;")).toBeUndefined();
  });
});

describe("guardScript", () => {
  it("will guard a script after stripping its types and JSX", async () => {
    const tsx = `import { Current, type Seat } from "@expressive/rpc";\nconst a: Seat = Current;\nexport const Page = () => <p>{a}</p>;`;

    expect(await guardScript(tsx, "/app/page.tsx")).toMatch(/^imports Current from @expressive\/rpc,/);
    expect(await guardScript(`import type { Current } from "@expressive/rpc";\nexport const a = 1;`, "/app/a.ts")).toBeUndefined();
  });

  it("will pass a file that is not a script, or a script that never names the package", async () => {
    expect(await guardScript(`{ "a": "import { Current } from \\"@expressive/rpc\\";" }`, "/app/notes.json")).toBeUndefined();
    expect(await guardScript(`import { Current } from "./current";`, "/app/a.ts")).toBeUndefined();
  });
});
