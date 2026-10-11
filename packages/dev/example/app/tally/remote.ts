import { State } from "@expressive/mvc";
import { Current } from "@expressive/dev/server";

export class Overflow extends Error {
  status = 409;

  constructor(public limit: number) {
    super(`The tally stops at ${limit}.`);
  }
}

class Tally extends State {
  static ttl = 3600;
  total = 0;
}

export async function add(by: number) {
  const tally = Tally.use();
  if (tally.total + by > 9) throw new Overflow(9);
  return (tally.total += by);
}

export async function reset() {
  Tally.use().total = 0;
}

export async function where() {
  return Current.get().url.pathname;
}

export async function fail(): Promise<never> {
  throw new Error("Nope");
}
