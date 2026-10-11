import * as THREE from 'three';

import { node } from './object';

/** `color` is live like a vector - assign one to dispatch, mutate in place silently. */
abstract class Light extends node(THREE.Light, ['color', 'intensity']) {}

class AmbientLight extends node(THREE.AmbientLight, [], Light) {}

/** Sky `color` from above, `groundColor` from below. */
class HemisphereLight extends node(THREE.HemisphereLight, ['groundColor'], Light) {}

/** Parallel rays from its position toward the world origin. */
class DirectionalLight extends node(THREE.DirectionalLight, [], Light) {}

class PointLight extends node(THREE.PointLight, ['distance', 'decay'], Light) {}

/** A cone from its position toward the world origin. */
class SpotLight extends node(THREE.SpotLight, ['distance', 'decay', 'angle', 'penumbra'], Light) {}

export { AmbientLight, DirectionalLight, HemisphereLight, Light, PointLight, SpotLight };
