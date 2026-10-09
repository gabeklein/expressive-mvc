import { State } from "@expressive/mvc";

export * from "./surface";

export function serve(): never {
  throw new Error("serve() runs on the server only.");
}

export class Current extends State {
  constructor() {
    super();
    throw new Error("Current is server-only.");
  }
}
