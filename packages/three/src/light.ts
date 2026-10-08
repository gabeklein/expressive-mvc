import * as THREE from 'three';

import { contract, Object3D } from './object';

/** A light - `color` is live like a vector: assign one to dispatch, mutate in place silently. */
abstract class Light<T extends THREE.Light = THREE.Light> extends Object3D<T> {
  declare color: THREE.Color;
  declare intensity: number;
}

class AmbientLight extends Light<THREE.AmbientLight> {
  protected create() {
    return new THREE.AmbientLight();
  }
}

/** Sky `color` from above, `groundColor` from below. */
class HemisphereLight extends Light<THREE.HemisphereLight> {
  declare groundColor: THREE.Color;

  protected create() {
    return new THREE.HemisphereLight();
  }
}

/** Parallel rays from its position toward the world origin. */
class DirectionalLight extends Light<THREE.DirectionalLight> {
  protected create() {
    return new THREE.DirectionalLight();
  }
}

class PointLight extends Light<THREE.PointLight> {
  declare distance: number;
  declare decay: number;

  protected create() {
    return new THREE.PointLight();
  }
}

/** A cone from its position toward the world origin. */
class SpotLight extends Light<THREE.SpotLight> {
  declare distance: number;
  declare decay: number;
  declare angle: number;
  declare penumbra: number;

  protected create() {
    return new THREE.SpotLight();
  }
}

Light.on({ setup: contract(['color', 'intensity']) });
HemisphereLight.on({ setup: contract(['groundColor']) });
PointLight.on({ setup: contract(['distance', 'decay']) });
SpotLight.on({ setup: contract(['distance', 'decay', 'angle', 'penumbra']) });

export { AmbientLight, DirectionalLight, HemisphereLight, Light, PointLight, SpotLight };
