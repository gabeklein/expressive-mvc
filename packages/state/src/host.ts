/**
 * Per-adapter interpretation manifest.
 *
 * Each adapter augments this interface to declare how it renders. The first
 * member is `node` - the element type produced by `Component.render`. Canonical
 * elements (which all adapters interpret to their own host primitives) slot in
 * here later as additional members, via the same augmentation - no new seam.
 *
 * ```ts
 * declare module '@expressive/state' {
 *   interface Host { node: React.ReactNode }
 * }
 * ```
 *
 * Note: only one adapter is expected per compilation. Two adapters augmenting
 * `node` with different types in the same build would conflict - by design.
 */
export interface Host { }

/**
 * Host element type produced by `Component.render`.
 * Resolves to `unknown` until an adapter augments {@link Host} with `node`.
 */
export type Node = Host extends { node: infer T } ? T : unknown;
