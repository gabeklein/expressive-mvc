import { handle } from "@expressive/rpc/calls";
import { todos } from "./data/todos";

interface Env {
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

/** The server: the calls, a route of its own beside them, and the static client for the rest. */
export default {
  async fetch(request: Request, env?: Env): Promise<Response | undefined> {
    const { pathname } = new URL(request.url);

    // Same module as the calls' - a todo added by a call is counted here.
    if (request.method === "GET" && pathname === "/health") return Response.json({ ok: true, todos: todos.length });

    return (await handle(request)) ?? env?.ASSETS?.fetch(request);
  },

  /** A Cron Trigger lands here under wrangler; this example schedules none. */
  async scheduled() {},
};
