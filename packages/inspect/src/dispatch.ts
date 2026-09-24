export type Call = [path: string[], args: unknown[]];

/** Serialized by `evaluate` into the page - must stay self-contained. */
export function dispatch(first: unknown, second?: unknown) {
  const call = (second ?? first) as Call;
  const api = (globalThis as { __EXPRESSIVE_INSPECT__?: Record<string, unknown> }).__EXPRESSIVE_INSPECT__;

  if (!api)
    throw new Error(
      "@expressive/inspect is not attached in this page - make '@expressive/inspect/install' the first import of the app entry."
    );

  let target: unknown = api;
  let owner: unknown;

  for (const key of call[0]) {
    owner = target;
    target = (target as Record<string, unknown>)[key];
  }

  return (target as Function).apply(owner, call[1]);
}
