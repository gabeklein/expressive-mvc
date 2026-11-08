/**
 * The app's calls, for its own server entry (`rpc({ entry })`): `handle(request)` answers a call
 * and gives any other request `undefined`. The rpc() Vite plugin provides this module to the
 * server it builds and runs; anywhere else, importing it throws.
 */
export const handle: (request: Request) => Promise<Response | undefined> = unavailable();

function unavailable(): never {
  throw new Error("@expressive/rpc/calls is provided by the rpc() Vite plugin to the server it builds - import it only from that server's entry or the modules it imports.");
}
