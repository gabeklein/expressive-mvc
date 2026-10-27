/**
 * Element classes.
 *
 * A class whose instances a host may render as elements declares itself here -
 * `Component`, `has` lists and pools, `map` collections. Each promises the same
 * small protocol: `is` names the instance behind a view (`Object.create(pool)`
 * renders the pool), and `render()` returns what to show. A host seams every
 * declared class through `elements` (re-exported by `jsx-runtime`), installing
 * its element seam on each prototype; declarations made before the host loaded
 * are replayed, so import order does not matter.
 *
 * This module imports nothing, so a collection used headless never loads the
 * JSX runtime - and a host never imports a collection to patch it, which keeps
 * `has` and `map` out of bundles that do not use them.
 */

/** What a declared class promises its host. */
interface Renderable {
  /** The instance to render - itself, or the source behind a derived view. */
  readonly is: Renderable;
  render(...args: any[]): unknown;
}

type Seam = (Type: Function) => void;

const ELEMENTS = new Set<Function>();

let seam: Seam | undefined;

/** Declare instances of `Type` elements, for a host to render. */
function element(Type: Function) {
  ELEMENTS.add(Type);
  seam?.(Type);
}

/**
 * Host-side: receive every declared class, past and future, to install the
 * host's element seam on. Pass `undefined` to stop.
 */
function elements(fn: Seam | undefined) {
  seam = fn;

  if (fn) for (const Type of ELEMENTS) fn(Type);
}

export { element, elements };
export type { Renderable, Seam };
