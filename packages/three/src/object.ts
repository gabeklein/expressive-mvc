import { Component } from '@expressive/mvc';
import * as THREE from 'three';

import { pass, Vec3 } from './pass';
import { target, TARGET } from './target';

/**
 * Base for every class which represents an object in the scene graph.
 *
 * A subclass declares `create` to make its three.js object once, then owns it:
 * fields pass values straight through, and methods drive it imperatively. JSX
 * is left with hierarchy and existence, so a scene's values never re-render it.
 *
 * Extending a primitive is the norm - that is where business logic external
 * actors call belongs. Everything internal to the contract is `protected`.
 */
abstract class Object3D extends Component {
  /** The three.js object this class represents. */
  declare protected readonly object: THREE.Object3D;

  visible = pass<boolean>();
  position = pass<Vec3>();
  rotation = pass<Vec3>();
  scale = pass<Vec3>();

  constructor(...args: any[]) {
    super(...args);

    // Created here, not in a lifecycle handler: a member spawned by `has()` or
    // `map()` activates during its owner's `new()`, before any later hook could
    // have made the owner's object exist. Nothing has applied props yet either,
    // so `create` cannot read them - fields pass them through afterward.
    if (!TARGET.has(this)) {
      const object = this.create();

      object.name = String(this);
      TARGET.set(this, object);
    }
  }

  /** Turn to face a point in world space. */
  lookAt(...at: Vec3) {
    this.object.lookAt(...at);
    this.set('rotation');
  }

  protected abstract create(): THREE.Object3D;
}

Object.defineProperty(Object3D.prototype, 'object', {
  get(this: Object3D) {
    return target(this.is);
  }
});

/** Root of a graph - what a React-hosted scene hangs from. */
class Scene extends Object3D {
  declare protected readonly object: THREE.Scene;

  protected create() {
    return new THREE.Scene();
  }
}

/** A bare transform - the usual place to put shared position or rotation. */
class Group extends Object3D {
  declare protected readonly object: THREE.Group;

  protected create() {
    return new THREE.Group();
  }
}

class Mesh extends Object3D {
  declare protected readonly object: THREE.Mesh;

  geometry = pass<THREE.BufferGeometry>();
  material = pass<THREE.Material | THREE.Material[]>();

  protected create() {
    return new THREE.Mesh();
  }
}

export { Group, Mesh, Object3D, Scene, Vec3 };
