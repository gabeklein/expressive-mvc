import { Model } from "@expressive/mvc";
import { Current } from "@expressive/dev/server";
import { HttpError } from "@expressive/rpc/http";

export class Overflow extends Error {
  status = 409;

  constructor(public limit: number) {
    super(`The tally stops at ${limit}.`);
  }
}

export class Closed extends HttpError {
  status = 423;
}

export default class Tally extends Model {
  static ttl = 3600;
  total = 0;
}

export async function add(by: number) {
  const tally = Tally.get();
  if (tally.total + by > 9) throw new Overflow(9);
  return (tally.total += by);
}

export async function reset() {
  Tally.get().total = 0;
}

export async function where() {
  return Current.get().url.pathname;
}

export async function fail(): Promise<never> {
  throw new Error("Nope");
}

export async function close(): Promise<never> {
  throw new Closed("The tally is closed.");
}
