import { State } from '@expressive/mvc';
import * as THREE from 'three';

const OBJECT = new WeakMap<object, THREE.Object3D>();
const NODE = new WeakMap<THREE.Object3D, Object3D>();
const AT = new WeakMap<Object3D, Object3D | undefined>();
const TOUCHED = new Set<Object3D>();
const WARNED = new WeakSet<Object3D>();

/** A scene graph node, representing the three.js object `create` returns. */
abstract class Object3D<T extends THREE.Object3D = THREE.Object3D> extends State {
  /**
   * The three.js object this node represents. Read values and mutate them per frame through members;
   * structure (`add`, `remove`, `parent`) and lifecycle (`dispose`) go through `parent` and destroying the node.
   */
  protected get _object(): T {
    const self = this.is;
    TOUCHED.add(self);
    return OBJECT.get(self) as T;
  }

  declare visible: boolean;

  /** Live vector - mutate in place to animate without dispatch; assign one to place and dispatch. */
  declare position: THREE.Vector3;
  declare rotation: THREE.Euler;
  declare scale: THREE.Vector3;

  /**
   * Node this one draws under. Unset follows ownership - the nearest owning node; `null` draws nowhere.
   * Placement never changes lifetime.
   */
  declare parent: Object3D | null | undefined;

  /** Nodes currently drawn under this one. */
  declare readonly children: readonly Object3D[];

  constructor(...args: State.Args) {
    super(...args);

    const object = this.create();

    object.name = String(this);
    OBJECT.set(this, object);
    NODE.set(object, this);
  }

  /** Turn to face a point in world space. */
  lookAt(target: THREE.Vector3): void;
  lookAt(x: number, y: number, z: number): void;
  lookAt(x: THREE.Vector3 | number, y?: number, z?: number) {
    const object = objectOf(this);

    if (typeof x == 'number') object.lookAt(x, y!, z!);
    else object.lookAt(x);

    this.set('rotation');
  }

  protected abstract create(): T;
}

class Group extends Object3D<THREE.Group> {
  protected create() {
    return new THREE.Group();
  }
}

class Scene extends Object3D<THREE.Scene> {
  protected create() {
    return new THREE.Scene();
  }
}

class Mesh extends Object3D<THREE.Mesh> {
  declare geometry: THREE.BufferGeometry;
  declare material: THREE.Material | THREE.Material[];

  protected create() {
    return new THREE.Mesh();
  }
}

type Members = Record<string, unknown>;

function objectOf(self: object) {
  return OBJECT.get(self)!;
}

/**
 * At `setup` a subclass default is still a plain own value - route it to the object.
 * `changed` runs after defaults land and after each write.
 */
function contract<T extends Object3D>(keys: string[], changed?: (object: THREE.Object3D) => void) {
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
        set(value: unknown) {
          try {
            return write(self, object, key, value);
          } finally {
            changed?.(object as unknown as THREE.Object3D);
          }
        }
      });
    }

    changed?.(object as unknown as THREE.Object3D);
  };
}

function vector(object: Members, key: string) {
  const value = object[key];
  return value instanceof THREE.Vector3 || value instanceof THREE.Euler || value instanceof THREE.Color
    ? (value as THREE.Vector3)
    : undefined;
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

const PLACED = new WeakMap<Object3D, Set<Object3D>>();

function placed(self: Object3D) {
  let set = PLACED.get(self);
  if (!set) PLACED.set(self, (set = new Set()));
  return set;
}

function owner(self: State) {
  for (let at = self.get(State, false); at; at = at.get(State, false))
    if (at instanceof Object3D) return at;
}

function alive(node: Object3D | null | undefined) {
  return node && !node.get(null) ? node.is : undefined;
}

/** `parent` stays out of the store, so a node held there is not adopted; an instruction on it is left to resolve. */
function placement(self: Object3D) {
  const own = Object.getOwnPropertyDescriptor(self, 'parent');

  if (!own || 'value' in own) {
    let value = own?.value as Object3D | null | undefined;

    delete (self as Partial<Object3D>).parent;

    (self as State).set('parent', {
      get: () => value,
      set(next: unknown) {
        if (next !== value) {
          value = next as Object3D | null | undefined;
          self.set('parent');
        }

        throw false;
      }
    });
  }

  (self as State).set('children', { get: () => [...placed(self)], set: false });
}

function mount(self: Object3D) {
  const object = objectOf(self);
  let at: Object3D | undefined;
  let release: (() => void) | undefined;

  function move(target: Object3D | undefined) {
    if (target === at) return;

    if (at) {
      release!();
      if (object.parent === objectOf(at)) object.removeFromParent();
      placed(at).delete(self);
      at.set('children');
    }

    at = target;
    AT.set(self, target);

    if (target) {
      objectOf(target).add(object);
      placed(target).add(self);
      target.set('children');
      release = target.get(null, resolve);
    }
  }

  function resolve() {
    const chosen = self.parent;
    move(chosen === null ? undefined : alive(chosen) || alive(owner(self)));
  }

  const stop = self.set((key) => {
    if (key === 'parent') resolve();
  });

  resolve();

  return () => {
    stop();
    move(undefined);
    TOUCHED.delete(self);
  };
}

/**
 * Check nodes reached through `_object` since the last call - one moved there instead of through
 * `parent` warns once, and goes back where `parent` puts it unless it now sits under a foreign object.
 */
function verify() {
  for (const node of TOUCHED) {
    const object = objectOf(node);
    const at = AT.get(node);
    const expected = at ? objectOf(at) : null;
    const actual = object.parent;

    if (actual === expected) continue;

    if (!WARNED.has(node)) {
      WARNED.add(node);
      console.warn(`${node} was moved through _object - place it with \`parent\` instead.`);
    }

    if (actual && !NODE.has(actual)) continue;

    if (expected) expected.add(object);
    else object.removeFromParent();
  }

  TOUCHED.clear();
}

Object3D.on({
  setup(self) {
    contract(['visible', 'position', 'rotation', 'scale'])(self);
    placement(self);
  },
  ready: mount
});

Mesh.on({ setup: contract(['geometry', 'material']) });

export { contract, Group, Mesh, Object3D, objectOf, Scene, verify };
