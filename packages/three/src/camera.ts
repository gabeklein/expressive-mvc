import * as THREE from 'three';

import { node, Object3D } from './object';

class PerspectiveCamera extends node(THREE.PerspectiveCamera, ['fov', 'aspect', 'near', 'far', 'zoom']) {}

/** A Viewport keeps its vertical extent and fits the width to its surface. */
class OrthographicCamera extends node(THREE.OrthographicCamera, ['left', 'right', 'top', 'bottom', 'near', 'far', 'zoom']) {}

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
