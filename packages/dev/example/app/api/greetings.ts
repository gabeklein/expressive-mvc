export async function hello(name = "World") {
  return `Hello ${name}!`;
}

export async function fail() {
  throw new Error("as requested");
}
