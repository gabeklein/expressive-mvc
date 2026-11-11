import express from "express";
import type { ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";

import { Model } from "@expressive/mvc";

import { Current, install } from "../context";
import { Cookies } from "../cookies";
import { Forbidden, Unauthorized } from "../errors";
import { fromNode } from "../node";
import { router, type Node } from "./tree";

install();

class Staff extends Model {
  static ttl = 0;
  static key() {
    return Current.get().request.headers.get("authorization") ?? undefined;
  }

  name = "";

  protected async new() {
    const token = Current.get().request.headers.get("authorization");
    if (!token) throw new Unauthorized("Sign in.");
    if (token !== "staff") throw new Forbidden("Staff only.");
    this.name = "Dana";
  }
}

class Prefs extends Cookies {
  seen?: string = undefined;
}

const emails = express.Router();
// Express gives `res.json`, `res.send`... only inside an app, so a router is mounted in one.
const app = express().use(emails);

emails.get("/attorney/:ar/scheduled", (req, res) => {
  res.set("x-previewed-by", Staff.get().name).type("html").send(`<p>${req.params.ar} at ${req.originalUrl}</p>`);
});

emails.get("/context", (req, res) => {
  Prefs.set({ seen: "yes" });
  res.json({ path: req.path, rest: Current.get().params["*"], query: req.query });
});

emails.get("/cookies", (_, res) => {
  res.cookie("a", "1").cookie("b", "2").status(204).end();
});

emails.get("/refuse", () => {
  throw new Forbidden("Not this one.");
});

emails.post("/echo", express.json(), (req, res) => {
  res.status(201).json(req.body);
});

emails.get("/stream", (_, res) => {
  res.setHeader("content-type", "text/event-stream");
  res.write("data: one\n\n");
  setTimeout(() => res.end("data: two\n\n"), 10);
});

const tree: Node = {
  children: {
    admin: {
      gate: async () => Staff,
      children: {
        email: { children: { "*": { file: async () => ({ GET: fromNode(app), POST: fromNode(app) }) } } },
        hello: { file: async () => ({ GET: fromNode((req, res) => res.end(`hello ${req.url}, ${req.socket.read()}`)) }) },
      },
    },
  },
};

const handle = router(tree, { dev: true });
const at = async (path: string, init: RequestInit = {}, token = "staff") =>
  (await handle(new Request(`http://localhost${path}`, { ...init, headers: { authorization: token, ...init.headers } })))!;

describe("fromNode", () => {
  it("will run an Express router below a [...] route, behind the folder's gate", async () => {
    const response = await at("/admin/email/attorney/7/scheduled");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("x-previewed-by")).toBe("Dana");
    expect(await response.text()).toBe("<p>7 at /admin/email/attorney/7/scheduled</p>");
    expect((await at("/admin/email/attorney/7/scheduled", {}, "")).status).toBe(401);
    expect((await at("/admin/email/attorney/7/scheduled", {}, "claimant")).status).toBe(403);
  });

  it("will give the handler the request's scope, and send what it sets", async () => {
    const response = await at("/admin/email/context?x=1");

    expect(await response.json()).toEqual({ path: "/context", rest: "context", query: { x: "1" } });
    expect(response.headers.getSetCookie()).toEqual(["seen=yes; Path=/; HttpOnly; SameSite=Lax"]);
  });

  it("will keep each header a handler sets, and no body where there is none", async () => {
    const response = await at("/admin/email/cookies");

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(response.headers.getSetCookie()).toEqual(["a=1; Path=/", "b=2; Path=/"]);
    expect((await at("/admin/email/attorney/7/scheduled", { method: "HEAD" })).body).toBeNull();
  });

  it("will read the request's body", async () => {
    const response = await at("/admin/email/echo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ a: 1 }) });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ a: 1 });
  });

  it("will stream what the handler writes as it writes it", async () => {
    const reader = (await at("/admin/email/stream")).body!.pipeThrough(new TextDecoderStream()).getReader();

    expect((await reader.read()).value).toBe("data: one\n\n");
    expect((await reader.read()).value).toBe("data: two\n\n");
    expect((await reader.read()).done).toBe(true);
  });

  it("will answer next() with 404 and next(error) as a throw", async () => {
    const missing = await at("/admin/email/nowhere");
    const refused = await at("/admin/email/refuse");

    expect(missing.status).toBe(404);
    expect((await missing.json()).message).toBe("No route at /admin/email/nowhere.");
    expect(refused.status).toBe(403);
    expect((await refused.json()).message).toBe("Not this one.");
  });

  it("will give a route that is not [...] its own path as /, and a socket with nothing of its own to read", async () => {
    expect(await (await at("/admin/hello?q=1")).text()).toBe("hello /?q=1, null");
  });

  it("will fail a handler that throws, a body that cannot be read, or a response closed unfinished", async () => {
    const thrown = fromNode(() => {
      throw new Error("Broke.");
    });
    const reading = fromNode(req => void req.resume());
    const body = new ReadableStream({ pull: controller => controller.error(new Error("Cut off.")) });
    const dropped = fromNode((_, res: ServerResponse) => void res.destroy());

    await expect(thrown(new Request("http://localhost/"))).rejects.toThrow("Broke.");
    await expect(reading(new Request("http://localhost/", { method: "POST", body, duplex: "half" } as RequestInit))).rejects.toThrow("Cut off.");
    await expect(dropped(new Request("http://localhost/x"))).rejects.toThrow("GET /x closed before its response was done.");
  });

  it("will close the handler's response when the request is aborted or the body cancelled", async () => {
    const closed: string[] = [];
    const open = (name: string) => fromNode((_, res: ServerResponse) => {
      res.on("close", () => closed.push(name));
      res.write("open");
    });
    const aborted = new AbortController();

    await open("aborted")(new Request("http://localhost/", { signal: aborted.signal }));
    aborted.abort();

    const response = await open("cancelled")(new Request("http://localhost/"));
    await response.body!.cancel();

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(closed).toEqual(["aborted", "cancelled"]);
  });
});
