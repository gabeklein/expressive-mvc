import { State } from '@expressive/mvc';
import { parent } from '@expressive/mvc/state';
import * as THREE from 'three';

type Vec3 = [number, number, number];

/**
 * Base for every class which represents an object in the scene graph.
 *
 * A subclass declares `create` to make its three.js object once, then owns it.
 * Each class passes a fixed set of its object's members through as reactive
 * fields - the object is the storage - and methods drive it imperatively.
 *
 * The graph mirrors ownership: a node joins under the nearest Object3D that owns
 * it - through a field or a `has()` pool, directly or via States in between - and
 * leaves when destroyed. Existence is ownership; there is no render pass.
 */
abstract class Object3D extends State {
  /** The three.js object this class represents. */
  protected readonly _object: THREE.Object3D;

  declare visible: boolean;
  declare position: Vec3;
  declare rotation: Vec3;
  declare scale: Vec3;

  constructor(...args: State.Args) {
    super(...args);

    this._object = this.create();
    this._object.name = String(this);
  }

  /** Turn to face a point in world space. */
  lookAt(...at: Vec3) {
    this._object.lookAt(...at);
    this.set('rotation');
  }

  protected abstract create(): THREE.Object3D;
}

/** A bare transform - the usual place to put shared position or rotation. */
class Group extends Object3D {
  declare protected readonly _object: THREE.Group;

  protected create() {
    return new THREE.Group();
  }
}

/** Root of a graph. */
class Scene extends Object3D {
  declare protected readonly _object: THREE.Scene;

  protected create() {
    return new THREE.Scene();
  }
}

class Mesh extends Object3D {
  declare protected readonly _object: THREE.Mesh;

  declare geometry: THREE.BufferGeometry;
  declare material: THREE.Material | THREE.Material[];

  protected create() {
    return new THREE.Mesh();
  }
}

type Members = Record<string, unknown>;

function objectOf(self: object) {
  return (self as unknown as { _object: THREE.Object3D })._object;
}

/**
 * Install `keys` as managed properties stored on the three.js object.
 *
 * Runs at `pre` - after every field initializer, before values are observed - so
 * a subclass default (`geometry = new SphereGeometry()`) is still a plain value
 * here and is routed to the object, where an instruction field would have been
 * silently replaced by it.
 */
function contract<T extends Object3D>(...keys: string[]) {
  return (self: T) => {
    const object = objectOf(self) as unknown as Members;

    for (const key of keys) {
      const own = Object.getOwnPropertyDescriptor(self, key);

      if (own && !('value' in own))
        throw new Error(
          `${self}.${key} is stored on its three.js object - assign a value, or derive one in an effect.`
        );

      if (own) {
        delete (self as unknown as Members)[key];
        place(object, key, own.value);
      }

      (self as State).set(key, {
        get: () => read(object, key),
        set: (value: unknown) => write(object, key, value)
      });
    }
  };
}

/** Members three writes by copy rather than assignment. */
function vector(object: Members, key: string) {
  const value = object[key];
  return value instanceof THREE.Vector3 || value instanceof THREE.Euler ? value : undefined;
}

function read(object: Members, key: string) {
  const v = vector(object, key);
  return v ? [v.x, v.y, v.z] : object[key];
}

function place(object: Members, key: string, value: unknown) {
  const v = vector(object, key);

  if (v) v.set(...(value as Vec3));
  else object[key] = value;
}

/** Setter for a passed-through member; an unchanged vector dispatches nothing. */
function write(object: Members, key: string, value: unknown) {
  const v = vector(object, key);

  if (!v) {
    object[key] = value;
    return;
  }

  const [x, y, z] = value as Vec3;

  if (v.x === x && v.y === y && v.z === z) throw false;

  v.set(x, y, z);

  return [x, y, z];
}

/** Nearest Object3D owning `self`, through any non-Object3D owners between. */
function owner(self: Object3D) {
  for (let at = parent(self); at; at = parent(at))
    if (at instanceof Object3D) return at;
}

Object3D.on({
  pre: contract('visible', 'position', 'rotation', 'scale'),
  new(self) {
    const above = owner(self);

    if (above) objectOf(above).add(objectOf(self));

    return () => {
      objectOf(self).removeFromParent();
    };
  }
});

Mesh.on({ pre: contract('geometry', 'material') });

export { Group, Mesh, Object3D, objectOf, Scene, Vec3 };
