/**
 * Element classes.
 *
 * A class whose instances a host may render as elements declares itself here -
 * `Component`, `has` lists and pools, `map` collections. Each promises the same
 * small protocol: `is` names the instance behind a view (`Object.create(pool)`
 * renders the pool), and `render()` returns what to show. A host adopts every
 * declared class through `adopter` (re-exported by `jsx-runtime`), installing
 * its element seam on each prototype; declarations made before the host loaded
 * are replayed, so import order does not matter.
 *
 * This module imports nothing, so a collection used headless never loads the
 * JSX runtime - and a host never imports a collection to patch it, which keeps
 * `has` and `map` out of bundles that do not use them.
 */

/** What an adopted class promises its host. */
interface Renderable {
  /** The instance to render - itself, or the source behind a derived view. */
  readonly is: Renderable;
  render(...args: any[]): unknown;
}

type Adopt = (Type: Function) => void;

const ELEMENTS = new Set<Function>();

let adopt: Adopt | undefined;

/** Declare instances of `Type` elements, for a host to render. */
function element(Type: Function) {
  ELEMENTS.add(Type);
  adopt?.(Type);
}

/**
 * Install the host's adoption - called once per declared class, past and
 * future. Pass `undefined` to stop adopting.
 */
function adopter(fn: Adopt | undefined) {
  adopt = fn;

  if (fn) for (const Type of ELEMENTS) fn(Type);
}

export { element, adopter };
export type { Renderable, Adopt };
