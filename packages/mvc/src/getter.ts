import { Context } from './context';
import { observed, origin } from './state';

import type { Model } from './state';

declare namespace getter {
  /**
   * Resolves what `get` returns. Receives the context to search and, when called
   * through an instance or instruction, the instance it was called from.
   */
  type Lookup<R = unknown> = (context: Context, from?: Model) => R;

  /**
   * Host seam for a standalone `get`. Runs `lookup` against the host's current
   * context and wraps a Model it returns, or returns `next()` where the host is
   * not active.
   */
  type Provider = (
    Type: Model.Extends,
    lookup: (context: Context) => unknown,
    next: () => unknown,
    requireValues?: boolean
  ) => unknown;
}

const PROVIDERS: getter.Provider[] = [];

/**
 * Resolve a static `get` of `Type`. Every `get` implementation calls this once,
 * synchronously, with `this` as `Type`.
 *
 * @param Type - Class `get` was called on.
 * @param lookup - Resolves the value from a context.
 * @param requireValues - Whether a host should track the result as `get(true)` does.
 */
function getter<R>(
  Type: Model.Extends,
  lookup: getter.Lookup<R>,
  requireValues?: boolean
): R {
  const from = origin(Type);

  if (from) return observed(from, Type, lookup(Context.get(from.is), from.is));

  const run = (index: number): unknown =>
    index < 0
      ? lookup(Context.root)
      : PROVIDERS[index](Type, lookup, () => run(index - 1), requireValues);

  return run(PROVIDERS.length - 1) as R;
}

/**
 * Register a host provider for standalone `get` calls. The latest registered
 * runs first.
 *
 * @returns Function to unregister.
 */
function provide(provider: getter.Provider) {
  PROVIDERS.push(provider);

  return () => {
    const index = PROVIDERS.indexOf(provider);
    if (index >= 0) PROVIDERS.splice(index, 1);
  };
}

export { getter, provide };
