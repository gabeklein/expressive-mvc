export class Overflow extends Error {
  status = 409;

  constructor(public limit: number) {
    super(`The tally stops at ${limit}.`);
  }
}

let total = 0;

export async function add(by: number) {
  if (total + by > 9) throw new Overflow(9);
  return (total += by);
}

export async function reset() {
  total = 0;
}

export async function fail(): Promise<never> {
  throw new Error("Nope");
}
