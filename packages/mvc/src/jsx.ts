/**
 * Renderable collections.
 *
 * A collection module declares its prototype here with a function reading the
 * members to render - `has` lists and pools, `map` entries. A host adopts
 * declared prototypes through `adopter` (re-exported by `jsx-runtime`), making
 * their instances pass as elements; declarations made before the host loaded
 * are replayed, so import order does not matter.
 *
 * This module imports nothing, so a collection used headless never loads the
 * JSX runtime - and a host never has to import a collection to patch it, which
 * is what keeps `has` and `map` out of bundles that do not use them.
 */

type Members = (self: any) => unknown[];
type Adopt = (prototype: object, members: Members) => void;

const RENDERABLE = new Map<object, Members>();

let adopt: Adopt | undefined;

/** Declare instances of `prototype` renderable, `members` reading what to render. */
function renderable(prototype: object, members: Members) {
  RENDERABLE.set(prototype, members);
  adopt?.(prototype, members);
}

/**
 * Install the host's adoption - called once per declared prototype, past and
 * future. Pass `undefined` to stop adopting.
 */
function adopter(fn: Adopt | undefined) {
  adopt = fn;

  if (fn) for (const [prototype, members] of RENDERABLE) fn(prototype, members);
}

export { renderable, adopter };
export type { Members, Adopt };
