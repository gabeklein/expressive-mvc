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

/** An orthographic camera - a Viewport keeps its vertical extent and fits the width to its surface. */
class OrthographicCamera extends Object3D<THREE.OrthographicCamera> {
  declare left: number;
  declare right: number;
  declare top: number;
  declare bottom: number;
  declare near: number;
  declare far: number;
  declare zoom: number;

  protected create() {
    return new THREE.OrthographicCamera();
  }
}

const project = (camera: THREE.Object3D) =>
  (camera as THREE.PerspectiveCamera | THREE.OrthographicCamera).updateProjectionMatrix();

OrthographicCamera.on({
  setup: contract(['left', 'right', 'top', 'bottom', 'near', 'far', 'zoom'], project)
});

/** Fit `camera` to a surface of `width` by `height`. */
function fit(camera: Object3D, width: number, height: number) {
  if (!height) return;

  const aspect = width / height;

  if (camera instanceof PerspectiveCamera) camera.aspect = aspect;
  else if (camera instanceof OrthographicCamera) {
    const center = (camera.left + camera.right) / 2;
    const half = ((camera.top - camera.bottom) / 2) * aspect;

    camera.set({ left: center - half, right: center + half });
  }
}

export { fit, OrthographicCamera, PerspectiveCamera };
