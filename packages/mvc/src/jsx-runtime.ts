import type { Component } from './component';

/**
 * Per-adapter interpretation manifest. Each adapter augments this interface to
 * declare how it renders; the first member is `node` - the element type produced
 * by `Component.render` (surfaced as `Component.Node`) - alongside `intrinsics`,
 * the host's tag map (surfaced as `JSX.IntrinsicElements`).
 *
 * ```ts
 * declare module '@expressive/mvc/jsx-runtime' {
 *   interface Host {
 *     node: React.ReactNode;
 *     intrinsics: React.JSX.IntrinsicElements;
 *   }
 * }
 * ```
 *
 * Only one adapter is expected per compilation; two augmenting the same member
 * with different types in the same build would conflict - by design.
 */
export interface Host { }

/**
 * Host JSX runtime, registered by an adapter (e.g. `@expressive/react`) as an
 * import side effect. One host per build - a second registration with a
 * different runtime throws.
 */
export interface HostRuntime {
  childrenOf(children: unknown): Component.Node[];
  isElement(node: unknown): boolean;
  jsx(type: unknown, props: object, key?: unknown): Component.Node;
  jsxDEV?(type: unknown, props: object, key?: unknown, isStatic?: boolean, source?: object, self?: unknown): Component.Node;
  jsxs(type: unknown, props: object, key?: unknown): Component.Node;
  propsOf(node: unknown): Record<string, unknown>;
  typeOf(node: unknown): unknown;
  Fragment: unknown;
}

export declare namespace JSX {
  type Element = Component.Node;
  type ElementType =
    | keyof IntrinsicElements
    | ((props: any) => Component.Node)
    | (abstract new (...args: any[]) => ElementClass);
  /**
   * Gates class element types on the `render` contract alone - requiring full
   * `Component` assignability trips contravariance on `props` members (e.g.
   * the `is` callback narrows per subclass), rejecting every subclass.
   */
  interface ElementClass { render(props?: any): Component.Node }
  interface ElementAttributesProperty { props: {} }
  interface ElementChildrenAttribute { children: {} }
  interface IntrinsicAttributes { key?: string | number | null }
  /**
   * Host tag manifest, via the {@link Host} seam. Resolves to `{}` until an
   * adapter augments `Host` with `intrinsics` - agnostic code is
   * components-only by design, since it cannot know what tags a host renders.
   */
  type IntrinsicElements =
    Host extends { intrinsics: infer T extends object } ? T : {};
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
function resolved(): HostRuntime {
  if (HOST) return HOST;

  throw new Error(
    'No JSX host is registered for @expressive/mvc. ' +
    "Import a host adapter (e.g. '@expressive/react') before anything renders - " +
    'typically as the first import of your application entry module.'
  );
}

/** Translate the agnostic Fragment sentinel to the host's Fragment. */
function hostType(type: unknown): unknown {
  return type === Fragment ? resolved().Fragment : type;
}

export function jsx(type: unknown, props: object, key?: unknown): Component.Node {
  return resolved().jsx(hostType(type), props, key);
}

export function jsxs(type: unknown, props: object, key?: unknown): Component.Node {
  return resolved().jsxs(hostType(type), props, key);
}

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

  return runtime.jsxDEV
    ? runtime.jsxDEV(resolvedType, props, key, isStatic, source, self)
    : isStatic
      ? runtime.jsxs(resolvedType, props, key)
      : runtime.jsx(resolvedType, props, key);
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