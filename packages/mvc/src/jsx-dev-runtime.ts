import type { Component } from './component';
import { Fragment, hostType, resolved } from './jsx';

export { Fragment };
export type { JSX } from './jsx-runtime';

/** Dev-transpiled element creation. Falls back to the production runtime when
 * the host registered no `jsxDEV` (prod-only host under a dev build). */
export function jsxDEV(
  type: unknown,
  props: object,
  key?: unknown,
  isStatic?: boolean,
  source?: object,
  self?: unknown
): Component.Node {
  const runtime = resolved();
  const resolvedType = hostType(type);

  if (runtime.jsxDEV)
    return runtime.jsxDEV(resolvedType, props, key, isStatic, source, self);

  return isStatic
    ? runtime.jsxs(resolvedType, props, key)
    : runtime.jsx(resolvedType, props, key);
}
