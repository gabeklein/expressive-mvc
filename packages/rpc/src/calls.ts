/** Where the rpc() plugin's dev server leaves its calls; the build replaces this module outright. */
const DEV = Symbol.for("@expressive/rpc/calls#dev");

interface Calls {
  handle(request: Request): Promise<Response | undefined>;
  within<T>(folder: string, run: () => T): Promise<Awaited<T>>;
}

function calls(): Calls {
  const dev = (globalThis as Record<symbol, Calls | undefined>)[DEV];

  if (!dev) throw new Error("@expressive/rpc/calls answers only in a server the rpc() Vite plugin builds or runs - call it from that server's entry.");

  return dev;
}

/**
 * The app's calls, for its own server entry (`rpc({ entry })`): answers a call and gives any
 * other request `undefined`. The rpc() plugin provides it to the server it builds and runs;
 * anywhere else, a call to it throws.
 */
export async function handle(request: Request): Promise<Response | undefined> {
  return calls().handle(request);
}

/**
 * Run part of an entry route as a call in `folder` (of the calls' `dir`) would run: each gate
 * along it is seated and its `new()` awaited, so `Session.get()` works within `run` as in a call.
 * A gate that refuses throws its error here. Runs only inside the entry's `fetch`.
 *
 * ```ts
 * if (pathname.startsWith("/files/")) return within("account", () => download(Session.get().user, pathname));
 * ```
 */
export async function within<T>(folder: string, run: () => T): Promise<Awaited<T>> {
  return calls().within(folder, run);
}
