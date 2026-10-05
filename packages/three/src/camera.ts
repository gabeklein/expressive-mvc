import * as THREE from 'three';

import { contract, Object3D } from './object';

/** A perspective camera - projection members update its matrix as they change. */
class PerspectiveCamera extends Object3D<THREE.PerspectiveCamera> {
  /** Vertical field of view, in degrees. */
  declare fov: number;
  /** Width over height - a Viewport keeps it in step with its canvas. */
  declare aspect: number;
  declare near: number;
  declare far: number;
  declare zoom: number;

  protected create() {
    return new THREE.PerspectiveCamera();
  }
}

PerspectiveCamera.on({
  setup: contract(['fov', 'aspect', 'near', 'far', 'zoom'], (camera) =>
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix()
  )
});

export { PerspectiveCamera };
