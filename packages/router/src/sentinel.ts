const SENTINEL = Symbol('sentinel');

type Sentinel =
  | { kind: 'redirect'; to: string; replace: boolean }
  | { kind: 'notFound' };

/**
 * Throw during render or data loading; the nearest Route navigates instead of
 * rendering. Replaces history by default - the interrupted URL never showed
 * content, so Back should not return to it. Pass `replace: false` to push.
 * Relative `to` resolves against the catching Route.
 */
export function redirect(to: string, replace = true): never {
  throw tagged(`Redirect to ${to}`, { kind: 'redirect', to, replace });
}

/**
 * Throw during render or data loading; the nearest Route un-matches for the
 * current URL, so its scope falls through to the `default` (404) branch.
 */
export function notFound(): never {
  throw tagged('Not found', { kind: 'notFound' });
}

/** Sentinel payload riding `error`, if it was thrown by `redirect`/`notFound`. */
export function sentinel(error: unknown): Sentinel | undefined {
  return error instanceof Error
    ? (error as { [SENTINEL]?: Sentinel })[SENTINEL]
    : undefined;
}

function tagged(message: string, signal: Sentinel) {
  return Object.assign(new Error(message), { [SENTINEL]: signal });
}
