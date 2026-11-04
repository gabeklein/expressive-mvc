import { afterEach, describe, expect, it, vi } from "vitest";

import type { Endpoint } from "../call";
import { handler } from "./call";
import { client } from "./client";
import * as errors from "./errors";

const { HttpError, NotFound, Redirect } = errors;

const STATUS: Record<string, number> = {
  HttpError: 500,
  BadRequest: 400,
  Unauthorized: 401,
  PaymentRequired: 402,
  Forbidden: 403,
  NotFound: 404,
  MethodNotAllowed: 405,
  Conflict: 409,
  Gone: 410,
  PayloadTooLarge: 413,
  UnprocessableEntity: 422,
  TooManyRequests: 429,
  InternalError: 500,
  NotImplemented: 501,
  ServiceUnavailable: 503,
};

class Payment extends HttpError {
  status = 402;
  constructor(public plan: string) { super(`Upgrade to ${plan}`); }
}

const throws = (error: unknown) => async () => { throw error; };

function serve(fn: () => unknown) {
  const endpoints: Endpoint[] = [{ pattern: ["shop"], exports: async () => ({ calls: { fn }, classes: { "/shop#Payment": Payment } }) }];
  const handle = handler(endpoints);
  const fetch = vi.fn(async (url: string, init: RequestInit) => (await handle(new Request(new URL(url, "http://localhost"), init)))!);

  vi.stubGlobal("fetch", fetch);
}

async function caught(fn: () => unknown, define?: (rpc: ReturnType<typeof client>) => void) {
  serve(fn);

  const rpc = client({ base: "http://localhost" });
  define?.(rpc);

  return rpc.send("/shop", { "x-expressive-call": "fn" }, []).catch((error: Error) => error);
}

afterEach(() => vi.unstubAllGlobals());

describe("http errors", () => {
  it("will carry each status and its class's name", () => {
    for (const [name, status] of Object.entries(STATUS)) {
      const error = new (errors as any)[name]("Oops");

      expect(error).toBeInstanceOf(HttpError);
      expect(error).toBeInstanceOf(Error);
      expect(error).toMatchObject({ name, status, message: "Oops" });
    }
  });

  it("will reply with an error's status and fixed id", async () => {
    const handle = handler([{ pattern: [], exports: async () => ({ calls: { fn: throws(new NotFound("No such cart")) }, classes: {} }) }]);
    const response = await handle(new Request("http://localhost/", { method: "POST", headers: { "content-type": "application/json", "x-expressive-call": "fn" }, body: "[]" }));

    expect(response!.status).toBe(404);
    expect(await response!.json()).toEqual({ error: "http:NotFound", message: "No such cart", status: 404 });
  });

  it("will rebuild each on the client as the same class, unexported", async () => {
    for (const [name, status] of Object.entries(STATUS)) {
      const Type = (errors as any)[name];
      const error = await caught(throws(new Type("Oops")));

      expect(error.constructor).toBe(Type);
      expect(error).toMatchObject({ name, status, message: "Oops" });
    }
  });

  it("will give an exported subclass its own id, rebuilt as the class the client defines", async () => {
    const error = await caught(throws(new Payment("pro")), rpc => rpc.define("/shop#Payment", "Payment"));

    expect(error.constructor).not.toBe(Error);
    expect(error).toMatchObject({ name: "Payment", status: 402, plan: "pro", message: "Upgrade to pro" });
  });

  it("will rebuild an exported subclass under the built-in its client definition names", async () => {
    const error = await caught(throws(new Payment("pro")), rpc => rpc.define("/shop#Payment", "Payment", "http:HttpError"));

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ name: "Payment", status: 402, plan: "pro" });
  });

  it("will rebuild an unexported subclass as its nearest built-in", async () => {
    class Teapot extends NotFound { status = 418; }

    const error = await caught(throws(new Teapot("Short and stout")));

    expect(error.constructor).toBe(NotFound);
    expect(error).toMatchObject({ status: 418, message: "Short and stout" });
  });
});

describe("Redirect", () => {
  it("will default to 302 and keep its location", () => {
    expect(new Redirect("/login")).toMatchObject({ name: "Redirect", status: 302, location: "/login", message: "/login" });
    expect(new Redirect("/moved", 301)).toMatchObject({ status: 301, location: "/moved" });
  });

  it("will reply 500 with its status and location, and rebuild as a Redirect", async () => {
    serve(throws(new Redirect("/login", 303)));

    const response = await fetch("/shop", { method: "POST", headers: { "content-type": "application/json", "x-expressive-call": "fn" }, body: "[]" });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "http:Redirect", message: "/login", status: 303, location: "/login" });

    const error = await caught(throws(new Redirect("/login", 303)));

    expect(error).toBeInstanceOf(Redirect);
    expect(error).toMatchObject({ status: 303, location: "/login", message: "/login" });
  });
});
