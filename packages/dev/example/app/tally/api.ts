let total = 0;

export async function add(by: number) {
  return (total += by);
}

export async function reset() {
  total = 0;
}

export async function fail(): Promise<never> {
  throw new Error("Nope");
}
