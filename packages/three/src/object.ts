import { State } from '@expressive/mvc';
import { parent } from '@expressive/mvc/state';
import * as THREE from 'three';

/** A scene graph node, representing the three.js object `create` returns. */
abstract class Object3D extends State {
  /** The three.js object this class represents. */
  protected readonly _object: THREE.Object3D;

  declare visible: boolean;

  /** Live vector - mutate in place to animate without dispatch; assign one to place and dispatch. */
  declare position: THREE.Vector3;
  declare rotation: THREE.Euler;
  declare scale: THREE.Vector3;

  constructor(...args: State.Args) {
    super(...args);

    this._object = this.create();
    this._object.name = String(this);
  }

  /** Turn to face a point in world space. */
  lookAt(target: THREE.Vector3): void;
  lookAt(x: number, y: number, z: number): void;
  lookAt(x: THREE.Vector3 | number, y?: number, z?: number) {
    if (typeof x == 'number') this._object.lookAt(x, y!, z!);
    else this._object.lookAt(x);

    this.set('rotation');
  }

  protected abstract create(): THREE.Object3D;
}

class Group extends Object3D {
  declare protected readonly _object: THREE.Group;

  protected create() {
    return new THREE.Group();
  }
}

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

/** At `setup` a subclass default is still a plain own value - route it to the object. */
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
        get: () => object[key],
        set: (value: unknown) => write(self, object, key, value)
      });
    }
  };
}

function vector(object: Members, key: string) {
  const value = object[key];
  return value instanceof THREE.Vector3 || value instanceof THREE.Euler ? (value as THREE.Vector3) : undefined;
}

function place(object: Members, key: string, value: unknown) {
  const v = vector(object, key);

  if (v) v.copy(value as THREE.Vector3);
  else object[key] = value;
}

function write(self: State, object: Members, key: string, value: unknown) {
  const v = vector(object, key);

  if (!v) {
    object[key] = value;
    return;
  }

  if (!v.equals(value as THREE.Vector3)) {
    v.copy(value as THREE.Vector3);
    self.set(key);
  }

  throw false;
}

function owner(self: Object3D) {
  for (let at = parent(self); at; at = parent(at))
    if (at instanceof Object3D) return at;
}

Object3D.on({
  setup: contract('visible', 'position', 'rotation', 'scale'),
  ready(self) {
    const above = owner(self);

    if (above) objectOf(above).add(objectOf(self));

    return () => {
      objectOf(self).removeFromParent();
    };
  }
});

Mesh.on({ setup: contract('geometry', 'material') });

export { Group, Mesh, Object3D, objectOf, Scene };
