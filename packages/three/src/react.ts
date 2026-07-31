import '@expressive/react';

import { Context } from '@expressive/mvc';

import { Object3D } from './object';
import { target } from './target';

/**
 * Compose scenes with plain React JSX - no `jsxImportSource` change and no
 * custom reconciler. React contributes only what it is good at here: hierarchy
 * and whether a node exists. Values reach three.js imperatively from each
 * class's own effects, so nothing rides the render pipeline per element.
 *
 * Attachment runs at activation rather than on commit. `mount` would be the
 * better hook, but it is not called for an instance placed as `{component}` -
 * which is how a `has()` or `map()` collection renders - so its members would
 * never join the graph. The cost is that a render attempt React later discards
 * attaches first and detaches when its context is popped.
 */
Object3D.on({
  after(self) {
    const parent = enclosing(self);

    if (parent) target(parent).add(target(self));

    return () => {
      target(self).removeFromParent();
    };
  }
});

/**
 * The node `self` attaches under: the nearest enclosing `Object3D` *explicitly*
 * provided to a context, walking up from wherever `self` was registered.
 *
 * A plain `get(Object3D)` is not enough. States adopted by `has()` or `map()`
 * live in their owner's context, where a type lookup can match a sibling - or
 * resolve to nothing once two siblings make it ambiguous. Explicit registration
 * is what a Component does for itself, so it separates "the node this context
 * belongs to" from "nodes that merely live in it".
 */
function enclosing(self: Object3D) {
  for (let at = Context.get(self); at; at = at.parent!) {
    const entries = at.provide.get(Object3D as never);

    if (entries)
      for (const [state, explicit] of entries)
        if (explicit && state !== self) return state as Object3D;
  }
}

export { pass } from './pass';
export { Frame, loop } from './frame';
export { Group, Mesh, Object3D, Scene } from './object';
export type { Vec3 } from './pass';
