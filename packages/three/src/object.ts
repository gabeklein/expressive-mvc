import { Component } from '@expressive/mvc';
import * as THREE from 'three';

type Vec3 = [number, number, number];

/**
 * Base for every class which contributes an object to the scene graph.
 *
 * Subclasses declare `create` to make the three.js object once, then treat it
 * as theirs: reactive fields drive it through effects, so JSX carries only
 * hierarchy. `create` runs during activation and so must not read suspending
 * state - gate an asset-dependent object at the call site instead.
 */
abstract class Object3D extends Component {
  /** The three.js object this class owns. Available from `new()` onward. */
  declare readonly object: THREE.Object3D;

  visible = true;
  position: Vec3 = [0, 0, 0];
  rotation: Vec3 = [0, 0, 0];
  scale: Vec3 | number = 1;

  protected abstract create(): THREE.Object3D;
}

Object3D.on({
  after(self) {
    Object.defineProperty(self, 'object', {
      value: self.create(),
      enumerable: false
    });

    self.object.name = String(self);

    return self.get(({ object, visible, position, rotation, scale }) => {
      object.visible = visible;
      object.position.set(...position);
      object.rotation.set(...rotation);

      if (typeof scale == 'number') object.scale.setScalar(scale);
      else object.scale.set(...scale);
    });
  }
});

/** A bare transform - the usual place to put shared position or rotation. */
class Group extends Object3D {
  declare readonly object: THREE.Group;

  protected create() {
    return new THREE.Group();
  }
}

class Mesh extends Object3D {
  declare readonly object: THREE.Mesh;

  geometry: THREE.BufferGeometry = new THREE.BufferGeometry();
  material: THREE.Material | THREE.Material[] = new THREE.MeshBasicMaterial();

  protected create() {
    return new THREE.Mesh();
  }
}

Mesh.on({
  after(self) {
    return self.get(({ object, geometry, material }) => {
      object.geometry = geometry;
      object.material = material;
    });
  }
});

export { Group, Mesh, Object3D, Vec3 };
