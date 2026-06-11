import type { Component } from './component';

/**
 * Host JSX runtime, registered by an adapter (e.g. `@expressive/react`) as an
 * import side effect. One host per build - a second registration with a
 * different runtime throws.
 */
export interface HostRuntime {
  jsx(type: unknown, props: object, key?: unknown): Component.Node;
  jsxs(type: unknown, props: object, key?: unknown): Component.Node;
  jsxDEV?(type: unknown, props: object, key?: unknown, isStatic?: boolean, source?: object, self?: unknown): Component.Node;
  Fragment: unknown;
  childrenOf(children: unknown): Component.Node[];
  isElement(node: unknown): boolean;
  typeOf(node: unknown): unknown;
  propsOf(node: unknown): Record<string, unknown>;
}

/**
 * Agnostic Fragment sentinel. The runtime entries translate it to the host's
 * Fragment on element creation; `typeOf` translates back, so identity checks
 * against this value hold for fragments from either pragma.
 */
export const Fragment = Symbol.for('@expressive/mvc.Fragment');

let HOST: HostRuntime | undefined;

/** Register the host JSX runtime. Idempotent for the same runtime. */
export function host(runtime: HostRuntime) {
  if (HOST && HOST !== runtime)
    throw new Error(
      'A different JSX host is already registered for @expressive/mvc. ' +
      'Only one host adapter may be active per build.'
    );

  HOST = runtime;
}

/** Current host runtime; throws a setup-pointing error when none registered. */
export function resolved(): HostRuntime {
  if (!HOST)
    throw new Error(
      'No JSX host is registered for @expressive/mvc. ' +
      "Import a host adapter (e.g. '@expressive/react') before anything renders - " +
      'typically as the first import of your application entry module.'
    );

  return HOST;
}

/** Translate the agnostic Fragment sentinel to the host's Fragment. */
export function hostType(type: unknown): unknown {
  return type === Fragment ? resolved().Fragment : type;
}

/** Flatten `children` to an array of nodes, per the host's semantics. */
export function childrenOf(children: unknown): Component.Node[] {
  return resolved().childrenOf(children);
}

/** Is `node` a host element? */
export function isElement(node: unknown): boolean {
  return resolved().isElement(node);
}

/** Element type of `node`; host Fragments surface as the agnostic `Fragment`. */
export function typeOf(node: unknown): unknown {
  const { typeOf, Fragment: hosted } = resolved();
  const type = typeOf(node);
  return type === hosted ? Fragment : type;
}

/** Props carried by element `node`. */
export function propsOf(node: unknown): Record<string, unknown> {
  return resolved().propsOf(node);
}
