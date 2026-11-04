import { describe, expect, it } from "vitest";

import * as client from "./http/client";
import * as server from "./http/server";
import { guard, SERVER_ONLY } from "./guard";

describe("server-only names", () => {
  it("will list what the server build exports and the browser build does not", () => {
    expect([...SERVER_ONLY].sort()).toEqual(["Current", "handler", "isCall", "reply", "send", "toNode", "toRequest"]);

    for (const name of SERVER_ONLY) expect(client).not.toHaveProperty(name);
    for (const name of Object.keys(client)) expect(SERVER_ONLY).not.toContain(name);
    expect(Object.keys(server)).toEqual(expect.arrayContaining([...SERVER_ONLY]));
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
});
