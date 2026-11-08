import { describe, expect, it } from "vitest";

import * as client from "./http/client";
import * as server from "./http/server";
import { guard, SERVER_ONLY } from "./guard";

describe("server-only names", () => {
  it("will list exactly what the server build exports and the browser build does not", () => {
    expect([...SERVER_ONLY].sort()).toEqual(Object.keys(server).filter(name => !(name in client)).sort());
  });
});

describe("guard", () => {
  it("will refuse a server-only name imported or re-exported from the http flavor", () => {
    expect(guard(`import { Current } from "@expressive/rpc/http";`)).toBe(
      "imports Current from @expressive/rpc/http, which only a server has - its browser build does not export it.",
    );
    expect(guard(`import { NotFound,\n  toNode as node, handler } from '@expressive/rpc/http'`)).toMatch(/^imports toNode, handler from .* export them\.$/);
    expect(guard(`export { reply } from "@expressive/rpc/http";`)).toMatch(/^imports reply /);
    expect(guard(`import def, { send } from "@expressive/rpc/http";`)).toMatch(/^imports send /);
  });

  it("will allow what the browser build exports, types, and other modules", () => {
    expect(guard(`import { call, configure, NotFound, Redirect } from "@expressive/rpc/http";`)).toBeUndefined();
    expect(guard(`import type { Current } from "@expressive/rpc/http";`)).toBeUndefined();
    expect(guard(`import { type Current, call } from "@expressive/rpc/http";`)).toBeUndefined();
    expect(guard(`import * as http from "@expressive/rpc/http";`)).toBeUndefined();
    expect(guard(`import { Current } from "@expressive/rpc";\nimport { call } from "@expressive/rpc/http";`)).toBeUndefined();
    expect(guard(`import { Current } from "@expressive/rpc/http/other";`)).toBeUndefined();
  });

  it("will pass a module that never names the http flavor", () => {
    expect(guard(`import { Current } from "@expressive/rpc";\nexport const a = Current;`)).toBeUndefined();
  });

  it("will ignore an import written only in a comment or a string", () => {
    expect(guard(`// import { Current } from "@expressive/rpc/http";\nexport const a = 1;`)).toBeUndefined();
    expect(guard(`/** e.g. import { toNode } from "@expressive/rpc/http" */\nexport const b = 2;`)).toBeUndefined();
    expect(guard("export const doc = `import { Current } from \"@expressive/rpc/http\"`;")).toBeUndefined();
  });
});
