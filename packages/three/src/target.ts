import type { Object3D } from 'three';

/**
 * The three.js object a wrapper represents. Held here rather than on the
 * instance so it stays off observed state and out of the public contract -
 * subclasses reach it as `this.object`, and nothing else can.
 */
const TARGET = new WeakMap<object, Object3D>();

function target(self: object): Object3D {
  const object = TARGET.get(self);

  if (!object)
    throw new Error(`${self} does not represent a three.js object.`);

  return object;
}

export { target, TARGET };
