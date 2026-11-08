/** Where the rpc() plugin's dev server leaves its handler; the build replaces this module outright. */
const DEV = Symbol.for("@expressive/rpc/calls#dev");

/**
 * The app's calls, for its own server entry (`rpc({ entry })`): answers a call and gives any
 * other request `undefined`. The rpc() plugin provides it to the server it builds and runs;
 * anywhere else, a call to it throws.
 */
export async function handle(request: Request): Promise<Response | undefined> {
  const dev = (globalThis as Record<symbol, typeof handle | undefined>)[DEV];

  if (!dev) throw new Error("@expressive/rpc/calls answers only in a server the rpc() Vite plugin builds or runs - call it from that server's entry.");

  return dev(request);
}
