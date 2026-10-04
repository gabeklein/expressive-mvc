export * from "./surface";

export function serve(): never {
  throw new Error("serve() runs on the server only.");
}
