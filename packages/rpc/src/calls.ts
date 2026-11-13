/** Where the rpc() plugin's dev server leaves its calls; the build replaces this module outright. */
const DEV = Symbol.for("@expressive/rpc/calls#dev");

interface Calls {
  handle(request: Request): Promise<Response | undefined>;
}

function calls(): Calls {
  const dev = (globalThis as Record<symbol, Calls | undefined>)[DEV];

  if (!dev) throw new Error("@expressive/rpc/calls answers only in a server the rpc() Vite plugin builds or runs - call it from that server's entry.");

  return dev;
}

/**
 * The app's `dir` as a server, for its own entry (`rpc({ entry })`): answers a call, or a request
 * a route module's `GET`, `POST`... takes, behind the gates of the folders along its path - and gives
 * any other request `undefined`. The rpc() plugin provides it to the server it builds and runs;
 * anywhere else, a call to it throws.
 */
export async function handle(request: Request): Promise<Response | undefined> {
  return calls().handle(request);
}
